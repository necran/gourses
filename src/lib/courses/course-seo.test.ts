import { describe, expect, it } from "vitest";
import {
  courseDescription,
  courseStructuredData,
  courseTitle,
  serializeStructuredData,
} from "./course-seo";
import type { CourseDetail } from "./get-course";

function curso(overrides: Partial<CourseDetail> = {}): CourseDetail {
  return {
    id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    source: "udemy",
    title: "The Complete Python Bootcamp",
    description: "Aprende Python desde cero hasta nivel avanzado.",
    priceAmount: 19.99,
    priceCurrency: "EUR",
    rating: 4.7,
    level: "All Levels",
    language: "es",
    instructor: "Jose Portilla",
    imageUrl: "https://img.example.com/a.jpg",
    affiliateUrl: "https://www.udemy.com/course/x/",
    category: "desarrollo",
    duration: { minMinutes: 990, maxMinutes: 990 },
    numReviews: null,
    numSubscribers: null,
    whatYouWillLearn: null,
    requirements: null,
    priceHistory: [],
    ...overrides,
  };
}

describe("courseTitle", () => {
  it("incluye el nombre del curso y su plataforma", () => {
    expect(courseTitle(curso())).toBe("The Complete Python Bootcamp — Udemy");
  });

  it("distingue la plataforma de origen", () => {
    expect(courseTitle(curso({ source: "coursera", title: "Machine Learning" }))).toBe(
      "Machine Learning — Coursera"
    );
  });

  // Más allá de ~60 caracteres Google trunca y la parte distintiva se pierde.
  it("recorta un título largo sin pasarse del límite útil", () => {
    const largo = courseTitle(curso({ title: "A".repeat(120) }));
    expect(largo.length).toBeLessThanOrEqual(60);
    expect(largo).toContain("…");
    expect(largo).toContain("Udemy");
  });

  it("no recorta un título que ya cabe", () => {
    expect(courseTitle(curso({ title: "Rust" }))).toBe("Rust — Udemy");
  });
});

describe("courseDescription", () => {
  it("antepone los datos que ayudan a decidir", () => {
    const d = courseDescription(curso());
    expect(d).toContain("19.99 EUR");
    expect(d).toContain("valoración 4.7");
    expect(d).toContain("16,5 h");
  });

  it("omite el precio cuando no se conoce, sin dejar huecos raros", () => {
    const d = courseDescription(
      curso({ source: "coursera", priceAmount: null, priceCurrency: null, rating: null })
    );
    expect(d).not.toMatch(/null|undefined|NaN/);
    expect(d).toContain("Coursera");
  });

  it("funciona con un curso sin ningún dato más que el título", () => {
    const d = courseDescription(
      curso({
        priceAmount: null,
        priceCurrency: null,
        rating: null,
        duration: null,
        description: null,
      })
    );
    expect(d).toBe("The Complete Python Bootcamp en Udemy.");
  });

  it("no supera el largo que muestran los buscadores", () => {
    const d = courseDescription(curso({ description: "x".repeat(500) }));
    expect(d.length).toBeLessThanOrEqual(160);
  });

  // Si dos fichas comparten descripción, Google no puede distinguirlas.
  it("da descripciones distintas a cursos distintos", () => {
    const a = courseDescription(curso({ title: "Curso A" }));
    const b = courseDescription(curso({ title: "Curso B" }));
    expect(a).not.toBe(b);
  });
});

describe("courseStructuredData", () => {
  const url = "https://gourses.com/curso/3f2504e0-4f89-41d3-9a0c-0305e82c3301";

  it("declara el curso y su plataforma", () => {
    const d = courseStructuredData(curso(), url);
    expect(d["@type"]).toBe("Course");
    expect(d.name).toBe("The Complete Python Bootcamp");
    expect(d.url).toBe(url);
    expect(d.provider).toEqual({ "@type": "Organization", name: "Udemy" });
  });

  it("declara el precio cuando se conoce", () => {
    const d = courseStructuredData(curso(), url);
    expect(d.offers).toEqual({
      "@type": "Offer",
      price: 19.99,
      priceCurrency: "EUR",
      category: "Paid",
    });
  });

  // Declarar datos que no se tienen es motivo de penalización manual.
  it("no declara precio cuando el curso no lo tiene", () => {
    const d = courseStructuredData(
      curso({ source: "coursera", priceAmount: null, priceCurrency: null }),
      url
    );
    expect(d.offers).toBeUndefined();
  });

  // Sin reviewCount, AggregateRating es un dato incompleto que Google puede
  // tomar por engañoso — mejor omitirlo que publicarlo a medias (HU-029).
  it("no declara valoración cuando no se conoce el número de reseñas", () => {
    const d = courseStructuredData(curso({ numReviews: null }), url);
    expect(d.aggregateRating).toBeUndefined();
  });

  it("declara AggregateRating cuando hay valoración y reseñas de verdad", () => {
    const d = courseStructuredData(curso({ rating: 4.7, numReviews: 1532 }), url);
    expect(d.aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: 4.7,
      reviewCount: 1532,
    });
  });

  it("no declara AggregateRating si hay reseñas pero no valoración", () => {
    const d = courseStructuredData(curso({ rating: null, numReviews: 1532 }), url);
    expect(d.aggregateRating).toBeUndefined();
  });

  // Cero reseñas no sostiene una valoración: no hay opiniones detrás.
  it("no declara AggregateRating con cero reseñas", () => {
    const d = courseStructuredData(curso({ rating: 4.7, numReviews: 0 }), url);
    expect(d.aggregateRating).toBeUndefined();
  });

  it("omite los campos opcionales que faltan en vez de ponerlos vacíos", () => {
    const d = courseStructuredData(
      curso({ description: null, instructor: null, imageUrl: null, language: null }),
      url
    );
    for (const campo of ["description", "instructor", "image", "inLanguage"]) {
      expect(d[campo]).toBeUndefined();
    }
  });
});

describe("serializeStructuredData", () => {
  it("produce JSON válido", () => {
    const json = serializeStructuredData({ name: "Curso normal" });
    expect(JSON.parse(json).name).toBe("Curso normal");
  });

  // El caso que importa: los títulos vienen de APIs de terceros y este JSON se
  // incrusta dentro de una etiqueta <script>. Sin escapar, un título así
  // cerraría la etiqueta y permitiría ejecutar código.
  it("neutraliza un intento de cerrar la etiqueta script", () => {
    const json = serializeStructuredData({
      name: "Curso</script><script>alert(1)</script>",
    });

    expect(json).not.toContain("</script>");
    expect(json).not.toContain("<script>");
    // Y sigue siendo JSON válido que conserva el texto original.
    expect(JSON.parse(json).name).toBe("Curso</script><script>alert(1)</script>");
  });

  it("escapa cualquier < o > aunque no formen una etiqueta", () => {
    const json = serializeStructuredData({ name: "C++ < C# > Java" });
    expect(json).not.toMatch(/[<>]/);
    expect(JSON.parse(json).name).toBe("C++ < C# > Java");
  });
});
