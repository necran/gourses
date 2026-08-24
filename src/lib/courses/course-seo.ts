import type { CourseDetail } from "./get-course";
import { formatDuration } from "./duration";

const NOMBRE_FUENTE: Record<string, string> = {
  udemy: "Udemy",
  coursera: "Coursera",
};

export function sourceLabel(source: string): string {
  return NOMBRE_FUENTE[source] ?? source;
}

// Título de la ficha. Lleva el nombre del curso y su plataforma porque es lo
// que la persona ha escrito en el buscador; el nombre del sitio lo añade
// después la plantilla del layout (HU-012).
//
// Se recorta a 60 caracteres útiles: más allá, Google trunca y la parte
// distintiva del título deja de verse en los resultados.
export function courseTitle(course: Pick<CourseDetail, "title" | "source">): string {
  const plataforma = sourceLabel(course.source);
  const limite = 60 - plataforma.length - 3;
  const nombre =
    course.title.length > limite ? course.title.slice(0, limite - 1).trimEnd() + "…" : course.title;

  return `${nombre} — ${plataforma}`;
}

// Descripción para los resultados de búsqueda. Antepone los datos que ayudan a
// decidir (precio, valoración, duración) y completa con la descripción del
// curso, porque es lo que diferencia una ficha de otra.
export function courseDescription(
  course: Pick<
    CourseDetail,
    "title" | "source" | "priceAmount" | "priceCurrency" | "rating" | "description" | "duration"
  >
): string {
  const datos: string[] = [];

  if (course.priceAmount !== null) {
    datos.push(`${course.priceAmount} ${course.priceCurrency ?? ""}`.trim());
  }
  if (course.rating !== null) datos.push(`valoración ${course.rating}`);

  const duracion = formatDuration(course.duration ?? null);
  if (duracion) datos.push(duracion);

  const cabecera = `${course.title} en ${sourceLabel(course.source)}`;
  const cifras = datos.length > 0 ? ` · ${datos.join(" · ")}` : "";
  const resumen = course.description ? ` ${course.description}` : "";

  const texto = `${cabecera}${cifras}.${resumen}`.replace(/\s+/g, " ").trim();

  // Google corta alrededor de los 160 caracteres.
  return texto.length > 160 ? texto.slice(0, 159).trimEnd() + "…" : texto;
}

// Datos estructurados (schema.org/Course) para que el buscador entienda que la
// página describe un curso concreto.
//
// Regla innegociable: **solo se declara lo que se sabe**. Inventar un precio o
// una valoración que no se tiene es motivo de penalización manual por parte de
// Google, y los cursos de Coursera no traen ninguno de los dos.
// Serializa los datos estructurados para incrustarlos dentro de una etiqueta
// <script>. `JSON.stringify` escapa comillas y barras, pero **no** la secuencia
// `</script>`: un título de curso que la contuviera cerraría la etiqueta y
// permitiría inyectar código. Los títulos vienen de APIs de terceros, así que
// no es hipotético. Se escapan `<` y `>` como secuencias unicode, que dentro de
// una cadena JSON significan exactamente lo mismo.
export function serializeStructuredData(datos: Record<string, unknown>): string {
  return JSON.stringify(datos).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

export function courseStructuredData(course: CourseDetail, url: string): Record<string, unknown> {
  const datos: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    url,
    provider: {
      "@type": "Organization",
      name: sourceLabel(course.source),
    },
  };

  if (course.description) datos.description = course.description;
  if (course.language) datos.inLanguage = course.language;
  if (course.instructor) {
    datos.instructor = { "@type": "Person", name: course.instructor };
  }
  if (course.imageUrl) datos.image = course.imageUrl;

  if (course.priceAmount !== null && course.priceCurrency) {
    datos.offers = {
      "@type": "Offer",
      price: course.priceAmount,
      priceCurrency: course.priceCurrency,
      category: "Paid",
    };
  }

  // schema.org exige un número de reseñas junto a la valoración
  // (`reviewCount`). Antes no se guardaba, así que la valoración no se
  // declaraba nunca: mejor omitirla que publicar un dato incompleto que
  // Google puede tomar por engañoso. Con `numReviews` real (HU-029), se
  // declara solo cuando hay las dos cosas — nunca una valoración a medias.
  if (course.rating !== null && course.numReviews !== null && course.numReviews > 0) {
    datos.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: course.rating,
      reviewCount: course.numReviews,
    };
  }

  return datos;
}
