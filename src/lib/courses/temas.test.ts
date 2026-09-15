import { describe, expect, it } from "vitest";
import {
  TEMAS,
  esTema,
  nombreEnFrase,
  nombreTema,
  superaUmbral,
  temasDelTitulo,
  UMBRAL_CURSOS_CON_RESENAS,
  UMBRAL_CURSOS_EN_ESPANOL,
} from "./temas";

// Títulos reales del catálogo (base de desarrollo, 2026-09-15), incluidos los
// falsos positivos encontrados al preparar HU-058.
describe("temasDelTitulo", () => {
  it.each([
    ["Python desde Cero: Aprende a Programar", ["python"]],
    ["Master en CSS 2026 (Domina CSS desde CERO)", ["desarrollo-web"]],
    ["JavaScript Moderno: Guía para dominar el lenguaje", ["desarrollo-web"]],
    ["Curso completo Figma 2024 + Diseño Web Responsive", ["desarrollo-web"]],
    ["ChatGPT para principiantes", ["inteligencia-artificial"]],
    ["Curso de Fotografía Digital", ["fotografia"]],
    ["Power BI desde cero", ["power-bi"]],
    ["PowerBI para analistas", ["power-bi"]],
    ["Diseño UX/UI con Figma", ["ux-ui"]],
    ["SAP: Supply Chain Logistics in R/3", ["sap"]],
  ])("«%s» → %j", (titulo, esperados) => {
    expect(temasDelTitulo(titulo)).toEqual(esperados);
  });

  it("un curso puede tener varios temas, en el orden de la lista", () => {
    expect(temasDelTitulo("Trading con Python y MetaTrader 5")).toEqual(["python", "trading"]);
  });

  // Falsos positivos reales: ninguno de estos títulos pertenece a ningún tema.
  it.each([
    ["Entrevista Laboral por Competencias: Método S.T.A.R.", "la R no es un tema"],
    ["Java y Spring Boot desde cero", "Java no es un tema, y no es JavaScript"],
    ["AWS Solutions Architect Professional: Certificación SAP-C02", "SAP-C02 es de AWS"],
    ["Growth Hacking para startups", "growth hacking es marketing, no ciberseguridad"],
    ["Historia del arte medieval", "«ia» dentro de otra palabra"],
    ["Excelencia en atención al cliente", "«excel» dentro de otra palabra"],
    ["Go from Zero to Hero", "Go no es un tema"],
  ])("«%s» no pertenece a ningún tema (%s)", (titulo) => {
    expect(temasDelTitulo(titulo)).toEqual([]);
  });

  it("una palabra con tilde al final de la palabra no rompe el límite", () => {
    expect(temasDelTitulo("Curso de guitarra eléctrica")).toEqual(["guitarra"]);
  });

  it("no distingue mayúsculas y reconoce acentos como parte de la palabra", () => {
    expect(temasDelTitulo("CURSO DE PSICOLOGÍA")).toEqual(["psicologia"]);
    expect(temasDelTitulo("Nutrición deportiva")).toEqual(["nutricion"]);
    expect(temasDelTitulo("Meditacion guiada")).toEqual(["meditacion-y-mindfulness"]);
  });

  it("un título sin temas devuelve una lista vacía", () => {
    expect(temasDelTitulo("Cocina italiana tradicional")).toEqual([]);
  });
});

describe("lista de temas", () => {
  it("tiene los 28 temas decididos, cada uno con su nombre", () => {
    expect(TEMAS).toHaveLength(28);
    for (const t of TEMAS) expect(nombreTema(t).length).toBeGreaterThan(1);
  });

  it("los identificadores sirven como segmento de dirección", () => {
    for (const t of TEMAS) expect(t).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe("nombreEnFrase", () => {
  it("los nombres comunes van en minúscula dentro de una frase", () => {
    expect(nombreEnFrase("inteligencia-artificial")).toBe("inteligencia artificial");
    expect(nombreEnFrase("edicion-de-video")).toBe("edición de vídeo");
  });

  it("los nombres propios se quedan como se escriben", () => {
    expect(nombreEnFrase("python")).toBe("Python");
    expect(nombreEnFrase("power-bi")).toBe("Power BI");
    expect(nombreEnFrase("ux-ui")).toBe("UX/UI");
    expect(nombreEnFrase("sap")).toBe("SAP");
  });
});

describe("esTema", () => {
  it("acepta un tema de la lista, tal cual", () => {
    expect(esTema("python")).toBe(true);
    expect(esTema("desarrollo-web")).toBe(true);
  });

  it.each([undefined, "", "Python", "javascript", "constructor", "__proto__", "python/../x", "' or 1=1"])(
    "rechaza %j",
    (valor) => {
      expect(esTema(valor)).toBe(false);
    }
  );
});

describe("superaUmbral", () => {
  const justo = { enEspanol: UMBRAL_CURSOS_EN_ESPANOL, enEspanolConResenas: UMBRAL_CURSOS_CON_RESENAS };

  it("justo en el borde, sí", () => {
    expect(superaUmbral(justo)).toBe(true);
  });

  it("un curso menos en español, no", () => {
    expect(superaUmbral({ ...justo, enEspanol: UMBRAL_CURSOS_EN_ESPANOL - 1 })).toBe(false);
  });

  it("muchos cursos pero sin reseñas suficientes, no", () => {
    expect(superaUmbral({ enEspanol: 200, enEspanolConResenas: UMBRAL_CURSOS_CON_RESENAS - 1 })).toBe(false);
  });
});
