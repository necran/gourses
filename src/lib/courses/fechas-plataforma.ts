// Fechas que publican las plataformas (HU-059): cuándo salió un curso y cuándo
// se actualizó por última vez. Vienen de APIs de terceros, así que se validan:
// una fecha mal formada, absurda o futura es `null` («no lo sabemos»), nunca se
// sustituye por «hoy», que colaría el curso en las novedades sin serlo.

const UN_DIA_MS = 24 * 60 * 60 * 1000;
// Ningún curso de estas plataformas es anterior: Udemy abrió en 2010 y
// Coursera en 2012. Una fecha más antigua es un valor por defecto o un error.
const PRIMERA_FECHA_POSIBLE = Date.UTC(2009, 0, 1);

function fechaRazonable(ms: number, ahora: Date): boolean {
  return Number.isFinite(ms) && ms >= PRIMERA_FECHA_POSIBLE && ms <= ahora.getTime() + UN_DIA_MS;
}

/** `published_time` de Udemy («2017-07-03T17:39:15Z») → ISO, o null. */
export function fechaPublicacionUdemy(valor: unknown, ahora: Date = new Date()): string | null {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(valor)) return null;
  const ms = Date.parse(valor);
  return fechaRazonable(ms, ahora) ? new Date(ms).toISOString() : null;
}

/** `last_update_date` de Udemy («2026-06-04») → «2026-06-04», o null. */
export function fechaActualizacionUdemy(valor: unknown, ahora: Date = new Date()): string | null {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const ms = Date.parse(`${valor}T00:00:00Z`);
  // `Date.parse` acepta «2026-02-31» y lo lleva a marzo: se exige que la fecha
  // vuelva igual que entró.
  if (!fechaRazonable(ms, ahora) || new Date(ms).toISOString().slice(0, 10) !== valor) return null;
  return valor;
}

/**
 * `startDate` de Coursera (milisegundos) → ISO, o null. Es la única fecha que
 * da su Catalog API; en cursos a demanda funciona como fecha de lanzamiento. Una
 * fecha futura (una convocatoria que aún no ha empezado) no es una novedad.
 */
export function fechaLanzamientoCoursera(valor: unknown, ahora: Date = new Date()): string | null {
  if (typeof valor !== "number" || valor <= 0) return null;
  return fechaRazonable(valor, ahora) ? new Date(valor).toISOString() : null;
}
