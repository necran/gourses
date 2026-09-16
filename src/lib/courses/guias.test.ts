import { describe, expect, it } from "vitest";
import { GUIAS, RUTA_GUIAS, descripcionIndiceGuias, tituloIndiceGuias } from "./guias";
import { RUTA_GUIA } from "./guia-plataformas";
import { RUTA_GUIA_PRECIOS } from "./guia-precios";

describe("índice de guías (HU-069)", () => {
  it("las guías publicadas se declaran en un solo sitio", () => {
    expect(GUIAS.map((g) => g.ruta)).toEqual([RUTA_GUIA, RUTA_GUIA_PRECIOS]);
  });

  it("cada guía tiene título y una frase de qué contesta", () => {
    for (const guia of GUIAS) {
      expect(guia.ruta, guia.titulo).toMatch(new RegExp(`^${RUTA_GUIAS}/`));
      expect(guia.titulo.length, guia.ruta).toBeGreaterThan(10);
      expect(guia.resumen.length, guia.ruta).toBeGreaterThan(40);
    }
  });

  it("ninguna guía promete nada que el catálogo no pueda sostener", () => {
    expect(JSON.stringify(GUIAS)).not.toMatch(/mejor|barato|gratis|oferta|descuento/i);
  });

  it("el índice tiene título y descripción propios, por debajo de 160 caracteres", () => {
    expect(tituloIndiceGuias()).toBe("Guías con datos del catálogo");
    expect(descripcionIndiceGuias()).toContain(`${GUIAS.length} guías`);
    expect(descripcionIndiceGuias().length).toBeLessThanOrEqual(160);
  });
});
