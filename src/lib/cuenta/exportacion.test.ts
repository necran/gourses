import { describe, expect, it } from "vitest";
import {
  VERSION_FORMATO,
  componerExportacion,
  nombreFicheroExportacion,
  type EntradaExportacion,
} from "./exportacion";
import type { FavoriteCourse } from "../favorites/favorites";

function curso(overrides: Partial<FavoriteCourse> = {}): FavoriteCourse {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    source: "udemy",
    title: "Curso de prueba",
    description: "Un titular",
    priceAmount: 19.99,
    priceCurrency: "EUR",
    rating: 4.5,
    level: "All Levels",
    language: "es",
    instructor: "Alguien",
    imageUrl: null,
    affiliateUrl: "https://www.udemy.com/course/prueba/",
    category: "desarrollo",
    duration: { minMinutes: 60, maxMinutes: 90 },
    numReviews: null,
    numSubscribers: null,
    whatYouWillLearn: null,
    requirements: null,
    resumenIA: null,
    ...overrides,
  };
}

function entrada(overrides: Partial<EntradaExportacion> = {}): EntradaExportacion {
  return {
    correo: "alguien@example.com",
    altaEn: "2026-08-01T10:00:00.000Z",
    avisosDeBajadaDePrecio: true,
    favoritos: [curso()],
    ...overrides,
  };
}

const AHORA = new Date("2026-08-21T09:30:00.000Z");

describe("componerExportacion", () => {
  it("incluye la cuenta, las preferencias y los favoritos", () => {
    const datos = componerExportacion(entrada(), AHORA);

    expect(datos.formato).toBe(VERSION_FORMATO);
    expect(datos.generadoEn).toBe("2026-08-21T09:30:00.000Z");
    expect(datos.cuenta).toEqual({
      correo: "alguien@example.com",
      altaEn: "2026-08-01T10:00:00.000Z",
    });
    expect(datos.preferencias).toEqual({ avisosDeBajadaDePrecio: true });
    expect(datos.favoritos).toHaveLength(1);
  });

  it("exporta cada curso con lo que la persona vio al guardarlo", () => {
    const datos = componerExportacion(entrada(), AHORA);

    expect(datos.favoritos[0]).toEqual({
      titulo: "Curso de prueba",
      plataforma: "udemy",
      enlace: "https://www.udemy.com/course/prueba/",
      precio: { importe: 19.99, divisa: "EUR" },
      categoria: "desarrollo",
      idioma: "es",
      nivel: "All Levels",
      instructor: "Alguien",
      valoracion: 4.5,
      duracionMinutos: { min: 60, max: 90 },
    });
  });

  // Un importe sin divisa no significa nada, así que el precio va entero o no va.
  it("deja el precio a null cuando no hay importe", () => {
    const datos = componerExportacion(
      entrada({ favoritos: [curso({ priceAmount: null, priceCurrency: null })] }),
      AHORA
    );

    expect(datos.favoritos[0].precio).toBeNull();
  });

  it("deja la duración a null cuando el curso no la publica", () => {
    const datos = componerExportacion(entrada({ favoritos: [curso({ duration: null })] }), AHORA);

    expect(datos.favoritos[0].duracionMinutos).toBeNull();
  });

  // Una cuenta recién creada sin nada guardado también tiene derecho a su
  // fichero: debe salir válido y vacío, no romperse ni omitir secciones.
  it("compone un fichero válido cuando no hay ni un favorito", () => {
    const datos = componerExportacion(
      entrada({ favoritos: [], avisosDeBajadaDePrecio: false }),
      AHORA
    );

    expect(datos.favoritos).toEqual([]);
    expect(datos.preferencias.avisosDeBajadaDePrecio).toBe(false);
    expect(datos.cuenta.correo).toBe("alguien@example.com");
  });

  // No se exporta la imagen ni el id interno: no son datos de la persona, son
  // del catálogo, y el id no le sirve de nada fuera de aquí.
  it("no arrastra campos internos del catálogo", () => {
    const datos = componerExportacion(entrada(), AHORA);
    const exportado = datos.favoritos[0] as unknown as Record<string, unknown>;

    expect(exportado).not.toHaveProperty("id");
    expect(exportado).not.toHaveProperty("imageUrl");
    expect(exportado).not.toHaveProperty("description");
  });

  it("es serializable a JSON sin perder nada", () => {
    const datos = componerExportacion(entrada(), AHORA);

    expect(JSON.parse(JSON.stringify(datos))).toEqual(datos);
  });
});

describe("nombreFicheroExportacion", () => {
  it("lleva la fecha para distinguir descargas", () => {
    expect(nombreFicheroExportacion(AHORA)).toBe("gourses-mis-datos-2026-08-21.json");
  });

  // El nombre queda en la carpeta de descargas y en el historial del navegador,
  // que es peor sitio para una dirección de correo que el interior del fichero.
  it("no contiene el correo ni nada que identifique a la persona", () => {
    const nombre = nombreFicheroExportacion(AHORA);

    expect(nombre).not.toContain("@");
    expect(nombre).toMatch(/^gourses-mis-datos-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
