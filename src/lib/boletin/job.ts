import type { Client } from "pg";
import { decidirAviso } from "../alertas/detectar.ts";
import type { EnviadorCorreo } from "../alertas/enviar.ts";
import {
  MAX_NOVEDADES,
  componerBoletin,
  desdeHaceUnaSemana,
  hayContenido,
  inicioSemana,
  mayoresBajadas,
  type Bajada,
  type ContenidoBoletin,
} from "./contenido.ts";

// Job del boletín semanal (HU-066). Corre fuera de la web, con Postgres directo,
// igual que los avisos de precio: la web nunca manda correo ni lee datos de otras
// personas.

export interface ResultadoBoletin {
  semana: string;
  suscritos: number;
  enviados: number;
  fallidos: number;
  sinContenido: boolean;
}

// Los cursos en español publicados en los últimos 7 días (HU-059), con el total
// aunque solo quepan los primeros.
const CONSULTA_NOVEDADES = `
  select id, source, title, price_amount::float as price_amount, price_currency,
         count(*) over ()::int as total
    from courses
   where language = 'es' and publicado_en >= $1
   order by publicado_en desc, id
   limit $2`;

// Cursos en español cuyo precio actual es más bajo que el anterior distinto, y
// cuyo cambio ocurrió en la última semana: la primera captura posterior al precio
// anterior es de esta semana. Mismo «anterior» que los avisos de HU-021.
const CONSULTA_BAJADAS = `
  select c.id, c.source, c.title,
         c.price_amount::float as precio_actual, c.price_currency as divisa_actual,
         anterior.price_amount::float as precio_anterior, anterior.price_currency as divisa_anterior
    from courses c
    join lateral (
      select h.price_amount, h.price_currency, h.captured_at
        from course_price_history h
       where h.course_id = c.id and h.price_amount is distinct from c.price_amount
       order by h.captured_at desc
       limit 1
    ) anterior on true
   where c.language = 'es'
     and c.price_amount is not null
     and anterior.price_amount > c.price_amount
     and (select min(h2.captured_at) from course_price_history h2
           where h2.course_id = c.id and h2.captured_at > anterior.captured_at) >= $1`;

// Quien está apuntado y aún no lo ha recibido esta semana.
const CONSULTA_SUSCRITOS = `
  select s.user_id, u.email, s.token_baja
    from boletin_suscripciones s
    join auth.users u on u.id = s.user_id
    left join boletines_enviados e on e.user_id = s.user_id and e.semana = $1
   where s.activo and u.email is not null and e.user_id is null`;

interface FilaNovedad {
  id: string;
  source: string;
  title: string;
  price_amount: number | null;
  price_currency: string | null;
  total: number;
}

interface FilaBajada {
  id: string;
  source: string;
  title: string;
  precio_actual: number;
  divisa_actual: string | null;
  precio_anterior: number;
  divisa_anterior: string | null;
}

export async function leerContenidoBoletin(client: Client, ahora: Date): Promise<ContenidoBoletin> {
  const desde = desdeHaceUnaSemana(ahora).toISOString();

  // Una detrás de otra: un cliente de pg no admite consultas simultáneas.
  const novedades = (await client.query<FilaNovedad>(CONSULTA_NOVEDADES, [desde, MAX_NOVEDADES])).rows;
  const candidatas = (await client.query<FilaBajada>(CONSULTA_BAJADAS, [desde])).rows;

  const bajadas: Bajada[] = [];
  for (const f of candidatas) {
    // El mismo criterio que los avisos: misma divisa y una bajada que no sea
    // insignificante.
    const decision = decidirAviso({
      precioActual: f.precio_actual,
      divisaActual: f.divisa_actual,
      precioAnterior: f.precio_anterior,
      divisaAnterior: f.divisa_anterior,
      precioYaAvisado: null,
      divisaYaAvisada: null,
    });
    if (!decision.avisar) continue;
    bajadas.push({
      id: f.id,
      source: f.source,
      title: f.title,
      precioAnterior: decision.precioAnterior,
      precioActual: decision.precioActual,
      divisa: decision.divisa,
    });
  }

  return {
    novedades: novedades.map((f) => ({
      id: f.id,
      source: f.source,
      title: f.title,
      priceAmount: f.price_amount,
      priceCurrency: f.price_currency,
    })),
    totalNovedades: novedades[0]?.total ?? 0,
    bajadas: mayoresBajadas(bajadas),
  };
}

export async function runBoletinJob({
  client,
  enviador,
  ahora = new Date(),
  log = console.log,
}: {
  client: Client;
  enviador: EnviadorCorreo;
  ahora?: Date;
  log?: (linea: string) => void;
}): Promise<ResultadoBoletin> {
  const semana = inicioSemana(ahora);
  const contenido = await leerContenidoBoletin(client, ahora);
  const { rows } = await client.query<{ user_id: string; email: string; token_baja: string }>(
    CONSULTA_SUSCRITOS,
    [semana]
  );

  if (!hayContenido(contenido)) {
    return { semana, suscritos: rows.length, enviados: 0, fallidos: 0, sinContenido: true };
  }

  let enviados = 0;
  let fallidos = 0;

  for (const fila of rows) {
    const mensaje = componerBoletin(contenido, fila.token_baja)!;
    try {
      await enviador.enviar(fila.email, mensaje);
    } catch (e) {
      // Sin la dirección en el log (ver enviar.ts). No se anota como enviado:
      // relanzar el job esta semana lo reintenta.
      fallidos += 1;
      log(`Fallo al enviar un boletín: ${(e as Error).message}`);
      continue;
    }

    // Después de enviar, como los avisos: al revés, un fallo dejaría la semana
    // marcada sin haber llegado nada.
    await client.query(
      `insert into boletines_enviados (user_id, semana) values ($1, $2) on conflict do nothing`,
      [fila.user_id, semana]
    );
    enviados += 1;
  }

  return { semana, suscritos: rows.length, enviados, fallidos, sinContenido: false };
}
