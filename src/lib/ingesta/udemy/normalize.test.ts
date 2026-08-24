import { describe, expect, it } from "vitest";
import {
  UdemyCourseValidationError,
  limpiarDescripcionHtml,
  normalizeUdemyCourse,
  type UdemyRawCourse,
} from "./normalize";

const BASE = "https://www.udemy.com";

// Copiado de una respuesta real de la API (campos recortados a los que usamos).
const rawCompleto: UdemyRawCourse = {
  id: 7053781,
  title: "AI Coder: Complete Claude Code & Coding Agents Course",
  url: "/course/ai-coder-from-vibe-coder-to-agentic-engineer/",
  headline: "Master Vibe Coding with AI Coding Agents",
  rating: 4.662027,
  avg_rating: 4.6108866,
  instructional_level_simple: "All Levels",
  instructional_level: "All Levels",
  locale: { locale: "en_US", title: "English (US)" },
  visible_instructors: [
    { display_name: "Ligency", title: "Ligency" },
    { display_name: "Ed Donner", title: "Ed Donner" },
  ],
  image_480x270: "https://img-c.udemycdn.com/course/480x270/7053781_bd4d.jpg",
  image_240x135: "https://img-c.udemycdn.com/course/240x135/7053781_bd4d.jpg",
};

// También copiado de una respuesta real, pidiendo fields[course] (HU-029).
const detalleCompleto = {
  price_detail: { amount: 17.99, currency: "EUR", price_string: "€17.99" },
  description: "<p>Aprende <strong>a programar</strong> con agentes de IA.</p>",
  what_you_will_learn_data: { items: ["Usar agentes de IA", "Automatizar tareas"] },
  requirements_data: { items: ["Conocimientos básicos de programación"] },
  num_reviews: 1532,
  num_subscribers: 24890,
};

describe("normalizeUdemyCourse", () => {
  it("normaliza un curso completo al esquema común", () => {
    expect(normalizeUdemyCourse(rawCompleto, detalleCompleto, BASE)).toEqual({
      source: "udemy",
      sourceId: "7053781",
      title: "AI Coder: Complete Claude Code & Coding Agents Course",
      // Ya no es el titular del listado: es la descripción real del detalle,
      // limpia de HTML (HU-029).
      description: "Aprende a programar con agentes de IA.",
      priceAmount: 17.99,
      priceCurrency: "EUR",
      priceUnknown: false,
      rating: 4.66,
      level: "All Levels",
      language: "en",
      instructor: "Ligency, Ed Donner",
      affiliateUrl:
        "https://www.udemy.com/course/ai-coder-from-vibe-coder-to-agentic-engineer/",
      imageUrl: "https://img-c.udemycdn.com/course/480x270/7053781_bd4d.jpg",
      category: null,
      numReviews: 1532,
      numSubscribers: 24890,
      whatYouWillLearn: ["Usar agentes de IA", "Automatizar tareas"],
      requirements: ["Conocimientos básicos de programación"],
      durationMinMinutes: null,
      durationMaxMinutes: null,
    });
  });

  it("deja a null los campos opcionales ausentes sin romper", () => {
    const minimo: UdemyRawCourse = { id: 1, title: "Curso mínimo", url: "/course/minimo/" };

    expect(normalizeUdemyCourse(minimo, null, BASE)).toEqual({
      source: "udemy",
      sourceId: "1",
      title: "Curso mínimo",
      description: null,
      priceAmount: null,
      priceCurrency: null,
      // Sin detalle, el precio no es "ninguno": es desconocido. Y con él van
      // la descripción y las estadísticas, porque vienen de la misma llamada.
      priceUnknown: true,
      rating: null,
      level: null,
      language: null,
      instructor: null,
      affiliateUrl: "https://www.udemy.com/course/minimo/",
      imageUrl: null,
      category: null,
      numReviews: null,
      numSubscribers: null,
      whatYouWillLearn: null,
      requirements: null,
      durationMinMinutes: null,
      durationMaxMinutes: null,
    });
  });

  // El titular del listado ya no sirve como descripción (era el fallo que
  // motivó esta historia): sin detalle, no hay descripción, no un titular
  // haciéndose pasar por una.
  it("no usa el titular del listado como descripción", () => {
    const resultado = normalizeUdemyCourse(rawCompleto, null, BASE);
    expect(resultado.description).toBeNull();
  });

  it("un curso sin what_you_will_learn ni requirements deja esas listas a null, no vacías", () => {
    const detalleSinListas = { price_detail: { amount: 9.99, currency: "EUR" } };
    const resultado = normalizeUdemyCourse(rawCompleto, detalleSinListas, BASE);
    expect(resultado.whatYouWillLearn).toBeNull();
    expect(resultado.requirements).toBeNull();
  });

  it("descarta un item de la lista que no sea texto, sin romper el resto", () => {
    const detalle = {
      what_you_will_learn_data: { items: ["Válido", 42, null, "Otro válido"] },
    };
    expect(normalizeUdemyCourse(rawCompleto, detalle, BASE).whatYouWillLearn).toEqual([
      "Válido",
      "Otro válido",
    ]);
  });

  it("ignora num_reviews o num_subscribers que no sean números", () => {
    const detalle = { num_reviews: "muchas", num_subscribers: null };
    const resultado = normalizeUdemyCourse(rawCompleto, detalle, BASE);
    expect(resultado.numReviews).toBeNull();
    expect(resultado.numSubscribers).toBeNull();
  });
});

describe("limpiarDescripcionHtml", () => {
  it("convierte párrafos en saltos de línea", () => {
    expect(limpiarDescripcionHtml("<p>Uno</p><p>Dos</p>")).toBe("Uno\nDos");
  });

  it("convierte una lista en líneas con viñeta", () => {
    expect(limpiarDescripcionHtml("<ul><li>A</li><li>B</li></ul>")).toBe("• A\n• B");
  });

  it("quita las etiquetas de énfasis sin dejar rastro", () => {
    expect(limpiarDescripcionHtml("<p><strong>Negrita</strong> y <em>cursiva</em></p>")).toBe(
      "Negrita y cursiva"
    );
  });

  it("decodifica las entidades HTML más comunes", () => {
    expect(limpiarDescripcionHtml("Antes&nbsp;y&nbsp;después")).toBe("Antes y después");
    expect(limpiarDescripcionHtml("Peque&amp;Grande")).toBe("Peque&Grande");
    expect(limpiarDescripcionHtml("&lt;script&gt;")).toBe("<script>");
    expect(limpiarDescripcionHtml("It&#39;s &quot;great&quot;")).toBe(`It's "great"`);
  });

  it("colapsa varios saltos de línea seguidos en uno solo en blanco", () => {
    expect(limpiarDescripcionHtml("<p>Uno</p><p></p><p></p><p>Dos</p>")).toBe("Uno\n\nDos");
  });

  it("recorta espacios al principio y al final", () => {
    expect(limpiarDescripcionHtml("  <p>Texto</p>  ")).toBe("Texto");
  });
});

describe("normalizeUdemyCourse — el resto de campos", () => {
  it("redondea la valoración a dos decimales, que es lo que admite la columna", () => {
    expect(normalizeUdemyCourse(rawCompleto, null, BASE).rating).toBe(4.66);
  });

  it("usa avg_rating cuando no viene rating", () => {
    const sinRating = { ...rawCompleto, rating: undefined };
    expect(normalizeUdemyCourse(sinRating, null, BASE).rating).toBe(4.61);
  });

  it("reduce el locale de Udemy al mismo formato de idioma que Coursera", () => {
    const casos: Array<[string, string]> = [
      ["en_US", "en"],
      ["es_ES", "es"],
      ["pt-BR", "pt"],
      ["ja_JP", "ja"],
    ];
    for (const [locale, esperado] of casos) {
      const raw = { ...rawCompleto, locale: { locale } };
      expect(normalizeUdemyCourse(raw, null, BASE).language).toBe(esperado);
    }
  });

  it("guarda precio null cuando el detalle no se pudo obtener, en vez de perder el curso", () => {
    const resultado = normalizeUdemyCourse(rawCompleto, null, BASE);
    expect(resultado.priceAmount).toBeNull();
    expect(resultado.priceCurrency).toBeNull();
    expect(resultado.title).toBe(rawCompleto.title);
  });

  it("ignora un price_detail con importe no numérico", () => {
    const detalleRaro = { price_detail: { amount: "17,99", currency: "EUR" } };
    expect(normalizeUdemyCourse(rawCompleto, detalleRaro, BASE).priceAmount).toBeNull();
  });

  it("convierte la url relativa del curso en absoluta", () => {
    expect(normalizeUdemyCourse(rawCompleto, null, BASE).affiliateUrl).toBe(
      "https://www.udemy.com/course/ai-coder-from-vibe-coder-to-agentic-engineer/"
    );
  });

  // HU-010: la categoría viene del ámbito que recorre la ingesta, no del curso.
  it("mapea al vocabulario común la categoría del ámbito recorrido", () => {
    expect(normalizeUdemyCourse(rawCompleto, null, BASE, "Development").category).toBe(
      "desarrollo"
    );
    expect(normalizeUdemyCourse(rawCompleto, null, BASE, "Health & Fitness").category).toBe(
      "salud-y-bienestar"
    );
  });

  it("deja la categoría a null si el ámbito no se conoce o no se pasa", () => {
    expect(normalizeUdemyCourse(rawCompleto, null, BASE, "Categoría Inventada").category).toBeNull();
    expect(normalizeUdemyCourse(rawCompleto, null, BASE).category).toBeNull();
  });

  it("lanza un fallo puntual (no de contrato) si falta id, title o url", () => {
    for (const campo of ["id", "title", "url"] as const) {
      const roto = { ...rawCompleto, [campo]: undefined };
      expect(() => normalizeUdemyCourse(roto, null, BASE)).toThrow(UdemyCourseValidationError);
    }
  });
});

// La distinción que impide que un 429 borre precios buenos (ver upsert-course).
describe("normalizeUdemyCourse — precio desconocido frente a precio ausente", () => {
  const minimo: UdemyRawCourse = { id: 1, title: "Curso mínimo", url: "/course/minimo/" };

  it("marca el precio como desconocido cuando no hubo detalle", () => {
    expect(normalizeUdemyCourse(minimo, null, BASE).priceUnknown).toBe(true);
  });

  // El detalle respondió; que no traiga precio es un dato, no una laguna.
  it("no lo marca cuando el detalle respondió sin precio", () => {
    const curso = normalizeUdemyCourse(minimo, {}, BASE);
    expect(curso.priceAmount).toBeNull();
    expect(curso.priceUnknown).toBe(false);
  });
});
