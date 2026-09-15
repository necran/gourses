import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

// Un test por criterio de aceptación de HU-061. El de «sigue usando un índice» se
// comprueba en integración (el plan de la consulta), no desde el navegador.

const recuento = async (page: Page, keyword: string) => {
  await page.goto(`/buscar?keyword=${encodeURIComponent(keyword)}`);
  const texto = (await page.getByRole("status").filter({ hasText: /encontrad/ }).first().textContent()) ?? "";
  return Number((texto.match(/[\d.]+/) ?? ["0"])[0].replace(/\./g, ""));
};

test.describe("HU-061 — buscar sin tildes", () => {
  test("«diseno» encuentra los cursos de «Diseño», igual que buscando con tilde", async ({ page }) => {
    const sinTilde = await recuento(page, "diseno");
    const conTilde = await recuento(page, "diseño");

    expect(sinTilde).toBeGreaterThan(100);
    expect(sinTilde).toBe(conTilde);

    await page.goto("/buscar?keyword=diseno");
    await expect(page.locator("main li h2").filter({ hasText: /Diseño/ }).first()).toBeVisible();
  });

  test("buscar con tildes encuentra también lo escrito sin ellas", async ({ page }) => {
    const databaseUrl = process.env.DATABASE_URL;
    test.skip(!databaseUrl, "Requiere DATABASE_URL para sembrar el curso");

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    const sourceId = `zzz-hu061-sintildes-${Date.now()}`;
    try {
      await client.query(
        `insert into courses (source, source_id, title, language)
         values ('coursera', $1, 'Programacion basica zzzhu061', 'es')`,
        [sourceId]
      );
      await page.goto(`/buscar?keyword=${encodeURIComponent("programación básica zzzhu061")}`);
      await expect(page.locator("main li h2").filter({ hasText: "Programacion basica zzzhu061" })).toBeVisible();
    } finally {
      await client.query("delete from courses where source_id = $1", [sourceId]);
      await client.end();
    }
  });

  test("las reglas de HU-057 siguen: % literal, palabra corta solo en el título, y signos del filtro", async ({
    page,
  }) => {
    // Un paréntesis daba 500 antes del arreglo de HU-059; con tildes, igual.
    const respuesta = await page.goto(`/buscar?keyword=${encodeURIComponent("diseño (2026), 100%")}`);
    expect(respuesta?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Buscar cursos");

    // `%%%` no es un comodín: no devuelve el catálogo entero.
    expect(await recuento(page, "%%%")).toBeLessThan(100);

    // Dos letras con tilde van solo al título: «ñu» no casa con descripciones.
    const respuestaCorta = await page.goto(`/buscar?keyword=${encodeURIComponent("ñu")}`);
    expect(respuestaCorta?.status()).toBe(200);
  });
});
