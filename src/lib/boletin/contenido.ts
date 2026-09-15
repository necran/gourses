import { TITULAR } from "../legal/titular.ts";
import { escaparHtml, type MensajeAviso } from "../alertas/mensaje.ts";

// Boletín semanal (HU-066). Todo lo de aquí es cálculo puro: qué semana es, qué
// bajadas se cuentan y cómo se escribe el correo. La lectura y el envío, en job.ts.

/** Cuántos días mira hacia atrás cada boletín. */
export const DIAS_BOLETIN = 7;
export const MAX_NOVEDADES = 10;
export const MAX_BAJADAS = 5;

// Sin importar la presentación de la web: este módulo lo ejecuta Node desde un
// script, y allí cada import necesita su extensión.
const PLATAFORMAS: Record<string, string> = { udemy: "Udemy", coursera: "Coursera" };
const plataforma = (source: string) => PLATAFORMAS[source] ?? source;

export interface CursoNuevo {
  id: string;
  source: string;
  title: string;
  priceAmount: number | null;
  priceCurrency: string | null;
}

export interface Bajada {
  id: string;
  source: string;
  title: string;
  precioAnterior: number;
  precioActual: number;
  divisa: string;
}

export interface ContenidoBoletin {
  /** Los primeros `MAX_NOVEDADES`, del más reciente al más antiguo. */
  novedades: CursoNuevo[];
  /** Cuántos cursos nuevos hay en total, aunque no quepan todos. */
  totalNovedades: number;
  bajadas: Bajada[];
}

const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El token de baja llega por la dirección: solo vale si tiene forma de UUID. */
export function esTokenBaja(token: unknown): token is string {
  return typeof token === "string" && TOKEN.test(token);
}

/** Lunes (UTC) de la semana de `ahora`, como «AAAA-MM-DD». Identifica cada envío. */
export function inicioSemana(ahora: Date): string {
  const dia = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
  dia.setUTCDate(dia.getUTCDate() - ((dia.getUTCDay() + 6) % 7));
  return dia.toISOString().slice(0, 10);
}

export function desdeHaceUnaSemana(ahora: Date): Date {
  return new Date(ahora.getTime() - DIAS_BOLETIN * 24 * 60 * 60 * 1000);
}

export function porcentajeBajada(anterior: number, actual: number): number {
  return Math.round(((anterior - actual) / anterior) * 100);
}

/** Las bajadas más grandes en porcentaje, como mucho `MAX_BAJADAS`. */
export function mayoresBajadas(bajadas: readonly Bajada[]): Bajada[] {
  return [...bajadas]
    .sort(
      (a, b) =>
        porcentajeBajada(b.precioAnterior, b.precioActual) - porcentajeBajada(a.precioAnterior, a.precioActual) ||
        a.id.localeCompare(b.id)
    )
    .slice(0, MAX_BAJADAS);
}

export function hayContenido(contenido: ContenidoBoletin): boolean {
  return contenido.novedades.length > 0 || contenido.bajadas.length > 0;
}

export function precio(cantidad: number, divisa: string | null): string {
  const importe = cantidad.toFixed(2).replace(".", ",");
  return divisa ? `${importe} ${divisa}` : importe;
}

export function urlBaja(token: string): string {
  return `${TITULAR.url}/boletin/baja?t=${encodeURIComponent(token)}`;
}

export function asuntoBoletin(contenido: ContenidoBoletin): string {
  const partes: string[] = [];
  const n = contenido.totalNovedades;
  if (n > 0) partes.push(`${n} ${n === 1 ? "curso nuevo" : "cursos nuevos"} en español`);
  const b = contenido.bajadas.length;
  if (b > 0) partes.push(`${b} ${b === 1 ? "bajada" : "bajadas"} de precio`);
  return `Esta semana: ${partes.join(" y ")}`;
}

/**
 * El boletín de una persona. El contenido es el mismo para todas; cambia el
 * enlace de baja, que lleva su token. Sin nada que contar, `null`: no se envía.
 */
export function componerBoletin(contenido: ContenidoBoletin, tokenBaja: string): MensajeAviso | null {
  if (!hayContenido(contenido)) return null;

  const urlCurso = (id: string) => `${TITULAR.url}/curso/${encodeURIComponent(id)}`;
  const urlNovedades = `${TITULAR.url}/novedades`;
  const urlCuenta = `${TITULAR.url}/mi-cuenta`;
  const baja = urlBaja(tokenBaja);
  const quedanMas = contenido.totalNovedades > contenido.novedades.length;

  const texto: string[] = [`Lo nuevo esta semana en el catálogo de ${TITULAR.sitio}.`, ``];
  const html: string[] = [`<p>Lo nuevo esta semana en el catálogo de ${escaparHtml(TITULAR.sitio)}.</p>`];

  if (contenido.novedades.length > 0) {
    texto.push(`CURSOS NUEVOS EN ESPAÑOL (${contenido.totalNovedades})`);
    html.push(`<h2>Cursos nuevos en español (${contenido.totalNovedades})</h2>`, `<ul>`);
    for (const c of contenido.novedades) {
      const coste = c.priceAmount === null ? "" : ` · ${precio(c.priceAmount, c.priceCurrency)}`;
      texto.push(`- ${c.title} (${plataforma(c.source)})${coste}`, `  ${urlCurso(c.id)}`);
      html.push(
        `<li><a href="${escaparHtml(urlCurso(c.id))}">${escaparHtml(c.title)}</a> ` +
          `<span>(${escaparHtml(plataforma(c.source))})${escaparHtml(coste)}</span></li>`
      );
    }
    html.push(`</ul>`);
    if (quedanMas) {
      texto.push(`Ver todos: ${urlNovedades}`);
      html.push(`<p><a href="${escaparHtml(urlNovedades)}">Ver todos los cursos nuevos</a></p>`);
    }
    texto.push(``);
  }

  if (contenido.bajadas.length > 0) {
    texto.push(`MAYORES BAJADAS DE PRECIO`);
    html.push(`<h2>Mayores bajadas de precio</h2>`, `<ul>`);
    for (const b of contenido.bajadas) {
      const antes = precio(b.precioAnterior, b.divisa);
      const ahora = precio(b.precioActual, b.divisa);
      const pct = porcentajeBajada(b.precioAnterior, b.precioActual);
      texto.push(`- ${b.title} (${plataforma(b.source)}): antes ${antes}, ahora ${ahora} (-${pct} %)`, `  ${urlCurso(b.id)}`);
      html.push(
        `<li><a href="${escaparHtml(urlCurso(b.id))}">${escaparHtml(b.title)}</a> ` +
          `<span>(${escaparHtml(plataforma(b.source))})</span>: antes <s>${escaparHtml(antes)}</s>, ` +
          `ahora <strong>${escaparHtml(ahora)}</strong> (-${pct} %)</li>`
      );
    }
    html.push(`</ul>`);
    texto.push(``);
  }

  const aviso = "Los precios son los del catálogo al preparar el boletín: en la plataforma pueden haber cambiado.";
  texto.push(
    aviso,
    ``,
    `--`,
    `Recibes este correo porque te apuntaste al boletín semanal de ${TITULAR.sitio}.`,
    `Darte de baja: ${baja}`,
    `También puedes hacerlo desde ${urlCuenta}`
  );
  html.push(
    `<p style="font-size:0.9em;color:#666">${escaparHtml(aviso)}</p>`,
    `<hr>`,
    `<p style="font-size:0.9em;color:#666">`,
    `Recibes este correo porque te apuntaste al boletín semanal de ${escaparHtml(TITULAR.sitio)}.`,
    `<a href="${escaparHtml(baja)}">Darte de baja</a> o gestionarlo en <a href="${escaparHtml(urlCuenta)}">tu cuenta</a>.`,
    `</p>`
  );

  return {
    asunto: asuntoBoletin(contenido),
    texto: texto.join("\n"),
    html: html.join("\n"),
    // Los clientes de correo enseñan su propio botón de «Cancelar suscripción».
    cabeceras: { "List-Unsubscribe": `<${baja}>` },
  };
}
