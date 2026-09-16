import { expect, test } from "@playwright/test";

// Criterios de HU-067 visibles en la web. El orden de cada plataforma se prueba
// en unitarios (qué se pide) e integración (qué devuelve la base): desde fuera
// no se ven las reseñas de cada tarjeta.

const PLAZO_DIAS = 90;

test.describe("HU-067 — novedades en la portada", () => {
  test("la portada enseña los últimos cursos en español, con su fecha", async ({ page }) => {
    await page.goto("/");

    const seccion = page.getByRole("region", { name: "Novedades en español" });
    await expect(seccion).toBeVisible();

    const tarjetas = seccion.locator("li");
    await expect(tarjetas).toHaveCount(4);

    const fechas = await seccion.locator("time").evaluateAll((ts) => ts.map((t) => t.getAttribute("datetime")!));
    expect(fechas).toHaveLength(4);
    const desde = Date.now() - PLAZO_DIAS * 24 * 60 * 60 * 1000;
    for (let i = 0; i < fechas.length; i++) {
      expect(Date.parse(fechas[i])).toBeGreaterThanOrEqual(desde);
      // De la más reciente a la más antigua, como en /novedades.
      if (i > 0) expect(Date.parse(fechas[i])).toBeLessThanOrEqual(Date.parse(fechas[i - 1]));
    }
    for (const texto of await seccion.locator("li p:last-of-type").allTextContents()) {
      expect(texto).toMatch(/^(Publicado|Lanzado) el \d{1,2} de [a-zé]+ de \d{4}$/);
    }
  });

  test("cada novedad lleva a su ficha, y «Ver todas» a la lista completa", async ({ page, request }) => {
    await page.goto("/");
    const seccion = page.getByRole("region", { name: "Novedades en español" });

    const fichas = await seccion.locator('a[href^="/curso/"]').evaluateAll((as) =>
      as.map((a) => a.getAttribute("href")!)
    );
    expect(fichas.length).toBeGreaterThan(0);
    for (const href of fichas) {
      expect((await request.get(href)).status(), href).toBe(200);
    }

    await seccion.getByRole("link", { name: "Ver todas →" }).click();
    await expect(page).toHaveURL(/\/novedades$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cursos nuevos en español");
  });
});
