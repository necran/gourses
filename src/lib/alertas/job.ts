import type { Client } from "pg";
import { decidirAviso, type MotivoNoAvisar } from "./detectar.ts";
import { componerAviso } from "./mensaje.ts";
import type { EnviadorCorreo } from "./enviar.ts";

export interface ResultadoAlertas {
  candidatos: number;
  enviados: number;
  fallidos: number;
  descartados: Record<MotivoNoAvisar, number>;
}

interface FilaCandidata {
  user_id: string;
  email: string;
  course_id: string;
  title: string;
  source: string;
  price_amount: string | null;
  price_currency: string | null;
  precio_anterior: string | null;
  divisa_anterior: string | null;
  precio_avisado: string | null;
  divisa_avisada: string | null;
}

function aNumero(v: string | null): number | null {
  return v === null ? null : Number(v);
}

// Una consulta que reúne, por cada favorito, todo lo que hace falta para decidir:
// el precio de ahora, el anterior del histórico y el último que se avisó.
//
// El precio anterior es la penúltima captura distinta de la actual, no la última
// sin más: la ingesta escribe una fila al día aunque el precio no cambie, así
// que "la anterior" sería casi siempre el mismo importe y no habría bajadas.
//
// Quedan fuera desde el principio quienes han desactivado los avisos. La
// ausencia de fila en alert_preferences significa "activados", de ahí el
// left join con coalesce.
const CONSULTA_CANDIDATOS = `
  select
    f.user_id,
    u.email,
    c.id as course_id,
    c.title,
    c.source,
    c.price_amount,
    c.price_currency,
    anterior.price_amount as precio_anterior,
    anterior.price_currency as divisa_anterior,
    s.price_amount as precio_avisado,
    s.price_currency as divisa_avisada
  from favorites f
  join auth.users u on u.id = f.user_id
  join courses c on c.id = f.course_id
  left join alert_preferences p on p.user_id = f.user_id
  left join price_alerts_sent s on s.user_id = f.user_id and s.course_id = f.course_id
  left join lateral (
    select h.price_amount, h.price_currency
    from course_price_history h
    where h.course_id = c.id
      and h.price_amount is distinct from c.price_amount
    order by h.captured_at desc
    limit 1
  ) anterior on true
  where coalesce(p.price_alerts_enabled, true)
    and c.price_amount is not null
    and u.email is not null
`;

// Recorre los favoritos de todo el mundo, avisa de las bajadas que lo merezcan y
// anota a qué precio se avisó para no repetirlo mañana (HU-021).
//
// Corre fuera de la web, con conexión directa a Postgres: la web nunca manda
// correo ni recorre datos de otras personas.
export async function runAlertasPrecioJob({
  client,
  enviador,
  log = console.log,
}: {
  client: Client;
  enviador: EnviadorCorreo;
  log?: (linea: string) => void;
}): Promise<ResultadoAlertas> {
  const { rows } = await client.query<FilaCandidata>(CONSULTA_CANDIDATOS);

  const descartados = {
    "sin-precio": 0,
    "sin-referencia": 0,
    "divisas-distintas": 0,
    "no-ha-bajado": 0,
    "bajada-insignificante": 0,
    "ya-avisado": 0,
  } satisfies Record<MotivoNoAvisar, number>;

  let enviados = 0;
  let fallidos = 0;

  for (const fila of rows) {
    const decision = decidirAviso({
      precioActual: aNumero(fila.price_amount),
      divisaActual: fila.price_currency,
      precioAnterior: aNumero(fila.precio_anterior),
      divisaAnterior: fila.divisa_anterior,
      precioYaAvisado: aNumero(fila.precio_avisado),
      divisaYaAvisada: fila.divisa_avisada,
    });

    if (!decision.avisar) {
      descartados[decision.motivo] += 1;
      continue;
    }

    const mensaje = componerAviso({
      tituloCurso: fila.title,
      cursoId: fila.course_id,
      plataforma: fila.source,
      precioAnterior: decision.precioAnterior,
      precioActual: decision.precioActual,
      divisa: decision.divisa,
    });

    try {
      await enviador.enviar(fila.email, mensaje);
    } catch (e) {
      // Que falle un envío no puede tumbar el job: los demás avisos del día
      // deben salir igual. Y no se anota como enviado, así que mañana se
      // reintenta solo.
      fallidos += 1;
      log(`Fallo al enviar un aviso del curso ${fila.course_id}: ${(e as Error).message}`);
      continue;
    }

    // Se anota **después** de enviar. Al revés, un fallo de envío dejaría el
    // aviso marcado como dado y esa bajada no se avisaría nunca.
    await client.query(
      `insert into price_alerts_sent (user_id, course_id, price_amount, price_currency, sent_at)
       values ($1, $2, $3, $4, now())
       on conflict (user_id, course_id)
       do update set price_amount = excluded.price_amount,
                     price_currency = excluded.price_currency,
                     sent_at = now()`,
      [fila.user_id, fila.course_id, decision.precioActual, decision.divisa]
    );

    enviados += 1;
  }

  return { candidatos: rows.length, enviados, fallidos, descartados };
}
