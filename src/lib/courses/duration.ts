// Duración normalizada a minutos (HU-011). Se guarda como rango porque las
// plataformas a menudo expresan la duración así ("2-4 hours a week"), y
// reducirlo a un punto medio sería afirmar una cifra que nadie ha publicado.
// Cuando la duración es exacta, mínimo y máximo coinciden.
export interface DurationRange {
  minMinutes: number;
  maxMinutes: number;
}

const NUM = String.raw`\d+(?:[.,]\d+)?`;
const HORAS = String.raw`(?:hours?|hrs?|horas?|heures?|h)`;
const MINUTOS = String.raw`(?:minutes?|minutos?|mins?|m)`;
const SEMANAS = String.raw`(?:weeks?|semanas?|semaines?)`;
// Unidades que multiplican como las semanas: "5 modules, 2-3 hours/module".
const TRAMOS = String.raw`(?:weeks?|semanas?|semaines?|modules?|módulos?|modulos?|months?|meses?)`;

// Palabras de relleno que no cambian el significado y aparecen en los datos
// reales ("Approximately 91 minutes", "5 hours of study").
const RELLENO =
  /\b(?:approximately|approx|around|about|total|totales|in total|of study|de estudio|estimated|estimadas?|unos|unas|aprox|to complete|para completar)\b\.?/gi;

// Números escritos con letra que aparecen en los datos ("Three weeks of study").
const NUMEROS_ESCRITOS: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", five: "5", six: "6",
  seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12",
  una: "1", uno: "1", dos: "2", tres: "3", cuatro: "4", cinco: "5", seis: "6",
  siete: "7", ocho: "8", nueve: "9", diez: "10", once: "11", doce: "12",
};

// Un mes de estudio se cuenta como 4 semanas: es la convención habitual en los
// propios cursos y evita descartar "3 months, 5 hours per week".
const SEMANAS_POR_UNIDAD: Array<[RegExp, number]> = [
  [/^(?:months?|meses?|mes)$/i, 4],
  [/.*/, 1],
];

function toNumber(raw: string): number {
  return Number(raw.replace(",", "."));
}

function normalizar(text: string): string {
  let s = text.toLowerCase();
  // Los paréntesis suelen repetir el dato de otra forma ("20 hours (4 hours
  // per week)"); quitarlos deja la cifra principal limpia.
  s = s.replace(/\([^)]*\)/g, " ");
  s = s.replace(/^[~≈><\s]+/, " ").replace(RELLENO, " ");
  s = s.replace(/\b[a-záéíóúü]+\b/gi, (w) => NUMEROS_ESCRITOS[w] ?? w);
  return s
    .replace(/[.,;]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Prosa que suma tramos ("4 hours of videos, plus a final project requiring
// about 5 hours"): quedarse con la primera cifra daría un total por debajo.
function esSumaDeTramos(s: string): boolean {
  return /\b(?:plus|además|ademas|y además)\b/.test(s);
}

// "4-8 hours/week" son horas POR SEMANA, no un total: sin saber cuántas
// semanas dura el curso, el total es desconocido. Tomarlo como total lo
// subestimaría gravemente, así que se descarta.
const POR_UNIDAD =
  /(?:\/|\bper\b|\ba\b|\bpor\b|\bcada\b)\s*(?:weeks?|semanas?|semaine?s?|days?|d[ií]as?|modules?|m[óo]dulos?|months?|mes(?:es)?)\b|\bsemanal(?:es)?\b|\bdiari[oa]s?\b/i;

function redondear(minutos: number): number {
  return Math.round(minutos);
}

function rango(min: number, max: number): DurationRange {
  return { minMinutes: redondear(min), maxMinutes: redondear(Math.max(min, max)) };
}

// "4 weeks of study, 2-4 hours a week" y también el orden inverso
// "3-4 hours per week for 6 weeks".
function factorSemanas(unidad: string): number {
  for (const [re, factor] of SEMANAS_POR_UNIDAD) {
    if (re.test(unidad)) return factor;
  }
  return 1;
}

function parseSemanasPorHoras(s: string): DurationRange | null {
  const tramosPrimero = new RegExp(
    String.raw`(${NUM})[\s-]*(${TRAMOS})\b.*?(${NUM})\s*(?:-|–|a|to|y)?\s*(${NUM})?\s*${HORAS}\b`,
    "i"
  );
  const horasPrimero = new RegExp(
    String.raw`(${NUM})\s*(?:-|–|a|to|y)?\s*(${NUM})?\s*${HORAS}\b.*?(?:per|a|por|for|durante)?\s*(${NUM})\s*(${TRAMOS})\b`,
    "i"
  );

  let tramos: number | null = null;
  let unidad = "";
  let horasMin: number | null = null;
  let horasMax: number | null = null;

  const m1 = s.match(tramosPrimero);
  if (m1) {
    tramos = toNumber(m1[1]);
    unidad = m1[2];
    horasMin = toNumber(m1[3]);
    horasMax = m1[4] ? toNumber(m1[4]) : horasMin;
  } else {
    const m2 = s.match(horasPrimero);
    if (m2) {
      horasMin = toNumber(m2[1]);
      horasMax = m2[2] ? toNumber(m2[2]) : horasMin;
      tramos = toNumber(m2[3]);
      unidad = m2[4];
    }
  }

  if (tramos === null || horasMin === null || horasMax === null) return null;
  if (tramos <= 0 || horasMin <= 0) return null;

  const total = tramos * factorSemanas(unidad);
  return rango(total * horasMin * 60, total * horasMax * 60);
}

// "1 hour 30 minutes", "4h 30m".
function parseHorasYMinutos(s: string): DurationRange | null {
  const re = new RegExp(String.raw`^(${NUM})\s*${HORAS}\s*(?:and|y|et)?\s*(${NUM})\s*${MINUTOS}$`, "i");
  const m = s.match(re);
  if (!m) return null;

  const total = toNumber(m[1]) * 60 + toNumber(m[2]);
  return rango(total, total);
}

// "2 hours", "1-2 hours", "106 minutes", "1.5 hours".
// Anclado a propósito: en prosa como "Around 4 hours of videos in total, plus a
// final project requiring about 5 hours" quedarse con el primer número daría
// una cifra falsa por debajo, así que se prefiere no dar ninguna.
function parseTotalSimple(s: string): DurationRange | null {
  const reHoras = new RegExp(String.raw`^(${NUM})\s*(?:-|–|a|to)?\s*(${NUM})?\s*${HORAS}\b(.*)$`, "i");
  const reMinutos = new RegExp(
    String.raw`^(${NUM})\s*(?:-|–|a|to)?\s*(${NUM})?\s*${MINUTOS}\b(.*)$`,
    "i"
  );

  // Una duración expresada por semana/día/módulo no es un total mientras no se
  // sepa cuántos tramos hay; eso lo resuelve parseSemanasPorHoras o nadie.
  if (POR_UNIDAD.test(s)) return null;

  for (const [re, factor] of [
    [reHoras, 60],
    [reMinutos, 1],
  ] as const) {
    const m = s.match(re);
    if (!m) continue;

    // Se admite una coletilla descriptiva ("12-18 hours videos and labs"), pero
    // no otra cifra: si queda un número suelto, la cadena dice algo más que un
    // total y quedarse con el primero sería inventar.
    if (/\d/.test(m[3] ?? "")) return null;

    const min = toNumber(m[1]);
    const max = m[2] ? toNumber(m[2]) : min;
    return min > 0 ? rango(min * factor, max * factor) : null;
  }

  return null;
}

// Interpreta la duración publicada por cualquiera de las dos plataformas.
// Devuelve null ante cualquier cosa que no se entienda con seguridad: un curso
// sin duración es mejor que un curso con una duración inventada.
export function parseDuration(text: string | null | undefined): DurationRange | null {
  if (!text || typeof text !== "string") return null;

  const s = normalizar(text);
  if (s.length === 0 || esSumaDeTramos(s)) return null;

  return parseSemanasPorHoras(s) ?? parseHorasYMinutos(s) ?? parseTotalSimple(s);
}

// Formato legible para la interfaz: "8–16 h", "2 h", "45 min".
export function formatDuration(duration: DurationRange | null): string | null {
  if (!duration) return null;

  const { minMinutes, maxMinutes } = duration;
  const fmt = (m: number) =>
    m < 60 ? `${m} min` : Number((m / 60).toFixed(1)).toString().replace(".", ",") + " h";

  return minMinutes === maxMinutes ? fmt(minMinutes) : `${fmt(minMinutes)}–${fmt(maxMinutes)}`;
}
