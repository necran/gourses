import { describe, expect, it } from "vitest";
import {
  CuotaDiariaAgotadaError,
  LONGITUD_MINIMA_DESCRIPCION,
  construirPrompt,
  esCuotaDiariaAgotada,
  huellaDescripcion,
  limpiarResumen,
  necesitaResumen,
  type CursoConEstadoResumen,
} from "./resumen-curso";
import { esReintentable } from "../ingesta/comun/reintentos";

describe("construirPrompt", () => {
  it("incluye el título y la descripción real, tal cual", () => {
    const prompt = construirPrompt({
      title: "Curso de prueba",
      description: "Este curso enseña exactamente esto y aquello.",
    });

    expect(prompt).toContain("Curso de prueba");
    expect(prompt).toContain("Este curso enseña exactamente esto y aquello.");
  });

  // El riesgo de esta función es que se le cuele una instrucción que invite a
  // inventar: por eso se prueba explícitamente lo contrario.
  it("pide explícitamente no inventar nada que el texto no diga", () => {
    const prompt = construirPrompt({ title: "X", description: "Y" });

    expect(prompt).toMatch(/no inventes/i);
    expect(prompt).toMatch(/usa solo lo que dice el texto/i);
  });

  it("pide el resumen en español, corto", () => {
    const prompt = construirPrompt({ title: "X", description: "Y" });

    expect(prompt).toMatch(/en español/i);
    expect(prompt).toMatch(/2 o 3 frases/i);
  });
});

describe("limpiarResumen", () => {
  it("recorta espacios sobrantes", () => {
    expect(limpiarResumen("  Un resumen.  ")).toBe("Un resumen.");
  });

  it("quita un encabezado tipo «Resumen:» que el modelo haya añadido pese a lo pedido", () => {
    expect(limpiarResumen("Resumen: Este curso enseña X.")).toBe("Este curso enseña X.");
    expect(limpiarResumen("Summary: This teaches X.")).toBe("This teaches X.");
  });

  it("quita comillas envolventes", () => {
    expect(limpiarResumen('"Un resumen entrecomillado."')).toBe("Un resumen entrecomillado.");
  });

  it("recorta un resumen desproporcionadamente largo sin partir una palabra", () => {
    const largo = "palabra ".repeat(200).trim();
    const resultado = limpiarResumen(largo);

    expect(resultado.length).toBeLessThan(largo.length);
    expect(resultado.endsWith("…")).toBe(true);
    expect(resultado.endsWith(" …")).toBe(false);
  });

  it("no toca un resumen ya limpio y de longitud normal", () => {
    expect(limpiarResumen("Un curso que enseña X, Y y Z en pocas horas.")).toBe(
      "Un curso que enseña X, Y y Z en pocas horas."
    );
  });
});

describe("huellaDescripcion", () => {
  // Tiene que coincidir con lo que calcula la migración 0009 en SQL, o los
  // resúmenes rellenados por la migración se darían por caducados.
  // Vectores de prueba publicados de SHA-256 (FIPS 180-2). La igualdad con el
  // `sha256()` de Postgres, acentos incluidos, se comprueba en integración.
  it("es el SHA-256 en hexadecimal del texto", () => {
    expect(huellaDescripcion("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
    expect(huellaDescripcion("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("cambia con cualquier cambio del texto, también uno mínimo", () => {
    expect(huellaDescripcion("Curso de Python")).not.toBe(huellaDescripcion("Curso de Python."));
  });
});

describe("cuota diaria agotada", () => {
  it("reconoce el 429 de cuota diaria por el nombre de la cuota", () => {
    expect(
      esCuotaDiariaAgotada(429, "Quota exceeded for GenerateRequestsPerDayPerProjectPerModel-FreeTier")
    ).toBe(true);
  });

  it("el 429 de ritmo por minuto no es cuota diaria: ese se pasa esperando", () => {
    expect(
      esCuotaDiariaAgotada(429, "Quota exceeded for GenerateRequestsPerMinutePerProjectPerModel-FreeTier")
    ).toBe(false);
  });

  it("otro código con «PerDay» en el mensaje tampoco lo es", () => {
    expect(esCuotaDiariaAgotada(500, "PerDay")).toBe(false);
    expect(esCuotaDiariaAgotada(undefined, "PerDay")).toBe(false);
  });

  // Si se reintentara, cada curso restante perdería 15 s en esperas inútiles.
  it("su error no se reintenta", () => {
    expect(esReintentable(new CuotaDiariaAgotadaError())).toBe(false);
  });
});

describe("necesitaResumen", () => {
  const DESCRIPCION = "d".repeat(LONGITUD_MINIMA_DESCRIPCION);

  function curso(overrides: Partial<CursoConEstadoResumen> = {}): CursoConEstadoResumen {
    return {
      id: "1",
      title: "Curso",
      description: DESCRIPCION,
      resumenIA: null,
      resumenIADescripcionSha256: null,
      ...overrides,
    };
  }

  it("hace falta cuando no hay resumen todavía", () => {
    expect(necesitaResumen(curso())).toBe(true);
  });

  // Un resumen como los de verdad: los buenos de la base pasan de 200
  // caracteres. Uno de dos palabras valía como ficha hasta HU-068, cuando
  // empezó a contar que el resumen guardado esté entero.
  const RESUMEN_BUENO =
    "Este curso enseña a programar en Python desde cero, con ejercicios prácticos en cada " +
    "módulo. Cubre estructuras de datos, funciones y manejo de errores.";

  // El caso que evita pagar dos veces por lo mismo.
  it("no hace falta si ya hay resumen de esta misma descripción", () => {
    expect(
      necesitaResumen(
        curso({ resumenIA: RESUMEN_BUENO, resumenIADescripcionSha256: huellaDescripcion(DESCRIPCION) })
      )
    ).toBe(false);
  });

  // HU-068: la huella coincide, así que sin el detector este resumen roto se
  // quedaba así para siempre.
  it("hace falta regenerar un resumen cortado a media palabra, aunque la descripción no haya cambiado", () => {
    expect(
      necesitaResumen(
        curso({
          resumenIA: "Este curso enseña a aplicar LLM SEO y",
          resumenIADescripcionSha256: huellaDescripcion(DESCRIPCION),
        })
      )
    ).toBe(true);
  });

  it("hace falta regenerar si la descripción ya no es la que se resumió", () => {
    expect(
      necesitaResumen(
        curso({
          resumenIA: "Resumen desactualizado.",
          resumenIADescripcionSha256: huellaDescripcion("otra descripción anterior"),
        })
      )
    ).toBe(true);
  });

  it("hace falta si hay resumen pero no se sabe de qué descripción salió", () => {
    expect(necesitaResumen(curso({ resumenIA: "Sin huella.", resumenIADescripcionSha256: null }))).toBe(
      true
    );
  });

  it("no hace falta si la descripción es demasiado corta para merecer resumen", () => {
    expect(necesitaResumen(curso({ description: "Corta." }))).toBe(false);
  });

  it("el umbral de longitud es una frontera exacta: justo por debajo no, justo en el límite sí", () => {
    expect(
      necesitaResumen(curso({ description: "d".repeat(LONGITUD_MINIMA_DESCRIPCION - 1) }))
    ).toBe(false);
    expect(
      necesitaResumen(curso({ description: "d".repeat(LONGITUD_MINIMA_DESCRIPCION) }))
    ).toBe(true);
  });
});
