import { describe, expect, it } from "vitest";
import { componerAviso, type DatosAviso } from "./mensaje";

function datos(cambios: Partial<DatosAviso> = {}): DatosAviso {
  return {
    tituloCurso: "Dibujo de figura: el gesto",
    cursoId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    plataforma: "udemy",
    precioAnterior: 49.99,
    precioActual: 19.99,
    divisa: "EUR",
    ...cambios,
  };
}

describe("HU-021 — texto del aviso", () => {
  it("el asunto lleva el precio nuevo y el título", () => {
    const { asunto } = componerAviso(datos());
    expect(asunto).toContain("19.99 EUR");
    expect(asunto).toContain("Dibujo de figura: el gesto");
  });

  it("el cuerpo dice de cuánto a cuánto y el porcentaje", () => {
    const { texto } = componerAviso(datos());
    expect(texto).toContain("49.99 EUR");
    expect(texto).toContain("19.99 EUR");
    expect(texto).toContain("-60 %");
  });

  it("enlaza a la ficha del curso en el sitio, no a la plataforma", () => {
    const { texto, html } = componerAviso(datos());
    const url = "https://gourses.com/curso/3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    expect(texto).toContain(url);
    expect(html).toContain(url);
  });

  // Mandar correo sin forma de darse de baja es spam, por muy útil que sea.
  it("siempre explica cómo dejar de recibirlos", () => {
    const { texto, html } = componerAviso(datos());
    for (const cuerpo of [texto, html]) {
      expect(cuerpo).toMatch(/dejar de recibir/i);
      expect(cuerpo).toContain("https://gourses.com/mi-cuenta");
      expect(cuerpo).toMatch(/favoritos/i);
    }
  });

  it("muestra siempre dos decimales", () => {
    const { texto } = componerAviso(datos({ precioAnterior: 20, precioActual: 15.5 }));
    expect(texto).toContain("20.00 EUR");
    expect(texto).toContain("15.50 EUR");
  });

  // El título viene de la API de la plataforma, no de nosotros: es contenido de
  // terceros dentro de un documento HTML, el mismo problema que en HU-016.
  describe("el título del curso no puede inyectar HTML", () => {
    const malicioso = '<script>alert(1)</script><img src=x onerror="alert(2)">';

    // Lo que hace daño es que llegue a formarse una etiqueta, no que aparezca
    // la palabra "onerror": con los ángulos escapados, ese texto es inerte. Se
    // comprueba entonces que ningún `<` del título sobreviva sin escapar.
    it("escapa las etiquetas en la versión HTML", () => {
      const { html } = componerAviso(datos({ tituloCurso: malicioso }));
      expect(html).not.toMatch(/<script/i);
      expect(html).not.toMatch(/<img/i);
      expect(html).toContain("&lt;script&gt;");
      expect(html).toContain("&lt;img");
    });

    it("escapa también la plataforma", () => {
      const { html } = componerAviso(datos({ plataforma: "<b>udemy</b>" }));
      expect(html).not.toContain("<b>udemy</b>");
      expect(html).toContain("&lt;b&gt;");
    });

    // La divisa sale del campo `currency` de la plataforma, que la ingesta
    // guarda sin exigirle forma alguna: es tan de terceros como el título.
    it("escapa también la divisa", () => {
      const { html } = componerAviso(
        datos({ divisa: 'EUR<a href="https://malo.example">reclama</a>' })
      );
      expect(html).not.toMatch(/<a href="https:\/\/malo\.example"/);
      expect(html).toContain("&lt;a href=");
    });

    it("las comillas no pueden romper un atributo", () => {
      const { html } = componerAviso(datos({ tituloCurso: '" onmouseover="alert(1)' }));
      expect(html).not.toContain('onmouseover="');
      expect(html).toContain("&quot;");
    });
  });
});
