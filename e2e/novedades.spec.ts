import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

// Un test por criterio de aceptación de HU-059 visible desde la web. Guardar las
// fechas en la ingesta se prueba en unitarios (normalización) e integración
// (CourseStore). El umbral de «pocas novedades → noindex» no se puede provocar
// con los datos reales sin alterar la base compartida; lo prueban los unitarios
// de superaUmbralNovedades.

const cabecera = (page: Page, selector: string, atributo = "content") =>
  page.locator(`head ${selector}`).first().getAttribute(atributo);

test.describe("HU-059 — cursos nuevos en español", () => {
  test("lista los cursos en español de los últimos 90 días, del más reciente al más antiguo, con su fecha", async ({
    page,
  }) => {
    await page.goto("/novedades");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cursos nuevos en español");

    const fechas = await page.locator("main ul li time").evaluateAll((ts) => ts.map((t) => t.getAttribute("datetime")!));
    expect(fechas.length).toBeGreaterThan(0);

    const hace90Dias = Date.now() - 90 * 24 * 60 * 60 * 1000;
    for (let i = 0; i < fechas.length; i++) {
      expect(Date.parse(fechas[i])).toBeGreaterThanOrEqual(hace90Dias);
      if (i > 0) expect(Date.parse(fechas[i])).toBeLessThanOrEqual(Date.parse(fechas[i - 1]));
    }
    for (const texto of await page.locator("main ul li p:first-of-type").allTextContents()) {
      expect(texto).toMatch(/^(Publicado|Lanzado) el \d{1,2} de [a-z]+ de \d{4}/);
    }
  });

  test("la presentación cuenta cuántos cursos nuevos hay y de qué plataformas", async ({ page }) => {
    await page.goto("/novedades");
    const intro = (await page.locator("main > div").first().textContent()) ?? "";

    const total = Number((intro.match(/publicado ([\d.]+) cursos? nuevos?/) ?? [])[1]?.replace(/\./g, ""));
    expect(total).toBeGreaterThan(0);
    expect(intro).toMatch(/Las fechas son las que publica cada plataforma/);

    let listados = 0;
    for (let pagina = 1; pagina <= 30; pagina++) {
      await page.goto(`/novedades${pagina > 1 ? `?pagina=${pagina}` : ""}`);
      const enEsta = await page.locator("main ul li").count();
      listados += enEsta;
      if (!(await page.getByRole("link", { name: "Siguiente →" }).count())) break;
    }
    expect(listados).toBe(total);
  });

  test("tiene título y descripción propios, y es canónica de sí misma", async ({ page }) => {
    await page.goto("/novedades");
    expect(await page.title()).toMatch(/^Cursos nuevos en español/);
    expect(await cabecera(page, 'meta[name="description"]')).toMatch(/en español publicados en Udemy y Coursera en los últimos 90 días/);
    expect(await cabecera(page, 'link[rel="canonical"]', "href")).toMatch(/\/novedades$/);

    await page.goto("/novedades?pagina=2");
    expect(await cabecera(page, 'link[rel="canonical"]', "href")).toMatch(/\/novedades\?pagina=2$/);
  });

  // El enlace de texto que había bajo los temas desapareció en HU-070: desde
  // HU-067 la portada tiene su propia sección de novedades, con las últimas y su
  // «Ver todas». La garantía —que desde la portada se llega a las novedades— es
  // la misma; el camino, mejor.
  test("la portada lleva a las novedades", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("region", { name: "Novedades en español" })
      .getByRole("link", { name: "Ver todas →" })
      .click();
    await expect(page).toHaveURL(/\/novedades$/);
  });

  test("la ficha de un curso con fechas dice cuándo se publicó y cuándo se actualizó", async ({ page }) => {
    const databaseUrl = process.env.DATABASE_URL;
    test.skip(!databaseUrl, "Requiere DATABASE_URL para sembrar el curso");

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    const sourceId = `zzz-hu059-fechas-${Date.now()}`;
    try {
      const { rows } = await client.query(
        `insert into courses (source, source_id, title, language, publicado_en, actualizado_en_plataforma)
         values ('udemy', $1, 'Curso HU-059 con fechas', 'en', '2017-07-03T17:39:15Z', '2026-06-04')
         returning id`,
        [sourceId]
      );
      await page.goto(`/curso/${rows[0].id}`);

      await expect(page.getByText("Publicado el 3 de julio de 2017 · Actualizado el 4 de junio de 2026")).toBeVisible();
    } finally {
      await client.query("delete from courses where source_id = $1", [sourceId]);
      await client.end();
    }
  });
});
