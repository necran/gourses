import { TITULAR } from "../legal/titular.ts";

export interface DatosAviso {
  tituloCurso: string;
  cursoId: string;
  plataforma: string;
  precioAnterior: number;
  precioActual: number;
  divisa: string;
}

export interface MensajeAviso {
  asunto: string;
  texto: string;
  html: string;
}

function formatearPrecio(cantidad: number, divisa: string): string {
  return `${cantidad.toFixed(2)} ${divisa}`;
}

function porcentajeBajada(anterior: number, actual: number): number {
  return Math.round(((anterior - actual) / anterior) * 100);
}

// Escapa el texto que va dentro del HTML del correo.
//
// El título del curso viene de Udemy o Coursera, no de nosotros: es contenido
// de terceros metido en un documento HTML, exactamente el mismo problema que ya
// obligó a escapar los datos estructurados de la ficha (HU-016). Un cliente de
// correo que interprete etiquetas convertiría un título malicioso en algo peor
// que un título feo.
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Compone el aviso (HU-021).
//
// Dice lo mínimo para decidir sin abrir nada: qué curso, cuánto costaba, cuánto
// cuesta y dónde verlo. Y siempre, cómo dejar de recibirlos: mandar correo sin
// salida es lo que convierte un aviso útil en spam.
export function componerAviso(datos: DatosAviso): MensajeAviso {
  const antes = formatearPrecio(datos.precioAnterior, datos.divisa);
  const ahora = formatearPrecio(datos.precioActual, datos.divisa);
  const bajada = porcentajeBajada(datos.precioAnterior, datos.precioActual);

  const urlCurso = `${TITULAR.url}/curso/${datos.cursoId}`;
  const urlCuenta = `${TITULAR.url}/mi-cuenta`;

  // El asunto lleva el precio: mucha gente decide con solo verlo en la bandeja.
  const asunto = `Ha bajado a ${ahora}: ${datos.tituloCurso}`;

  const texto = [
    `Un curso que guardaste ha bajado de precio.`,
    ``,
    `${datos.tituloCurso} (${datos.plataforma})`,
    `Antes: ${antes}`,
    `Ahora: ${ahora}  (-${bajada} %)`,
    ``,
    `Verlo: ${urlCurso}`,
    ``,
    `Te escribimos porque tienes este curso en favoritos. Para dejar de recibir`,
    `estos avisos, desactívalos en ${urlCuenta} o quita el curso de tus favoritos.`,
  ].join("\n");

  // La divisa también es dato de terceros: la ingesta guarda lo que venga en el
  // campo `currency` de la plataforma, sin exigirle forma alguna. Que "casi
  // siempre" sea EUR o USD no la convierte en segura.
  const html = [
    `<p>Un curso que guardaste ha bajado de precio.</p>`,
    `<p><strong>${escaparHtml(datos.tituloCurso)}</strong><br>`,
    `<span>${escaparHtml(datos.plataforma)}</span></p>`,
    `<p>Antes: <s>${escaparHtml(antes)}</s><br>`,
    `Ahora: <strong>${escaparHtml(ahora)}</strong> (-${bajada} %)</p>`,
    `<p><a href="${urlCurso}">Ver el curso</a></p>`,
    `<hr>`,
    `<p style="font-size:0.9em;color:#666">`,
    `Te escribimos porque tienes este curso en favoritos. Para dejar de recibir`,
    `estos avisos, <a href="${urlCuenta}">desactívalos en tu cuenta</a> o quita el`,
    `curso de tus favoritos.`,
    `</p>`,
  ].join("\n");

  return { asunto, texto, html };
}
