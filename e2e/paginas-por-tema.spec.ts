import { expect, test, type Page } from "@playwright/test";

// Un test por criterio de aceptación de HU-058 que se puede comprobar con los
// datos reales. El de «un tema por debajo del umbral se marca noindex» no: en la
// base de desarrollo los 28 temas lo superan, y provocarlo exigiría alterar datos
// compartidos mientras corren otras pruebas. Esa decisión se prueba en los
// unitarios de superaUmbral (ver la historia).

const cabecera = (page: Page, selector: string, atributo = "content") =>
  page.locator(`head ${selector}`).first().getAttribute(atributo);

// Solo el texto propio de la página: titular y presentación. Las descripciones
// de los cursos son de las plataformas y pueden decir cualquier cosa.
const textoPropio = (page: Page) => page.locator("main h1, main > div").allTextContents();

test.describe("HU-058 — páginas por tema en español", () => {
  test("la página del tema tiene su titular y lista sus cursos en español", async ({ page }) => {
    await page.goto("/cursos/python");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cursos de Python en español");
    const tarjetas = page.locator("main ul li");
    const cuantas = await tarjetas.count();
    expect(cuantas).toBeGreaterThan(0);
    // La línea de datos de cada tarjeta (plataforma · precio · … · idioma), no la
    // descripción: esa es de la plataforma y puede mencionar cualquier cosa.
    const metas = await page.locator("main ul li p:first-of-type").allTextContents();
    expect(metas).toHaveLength(cuantas);
    for (const meta of metas) expect(meta).toContain("Español");
  });

  test("la presentación da datos del catálogo que coinciden con lo listado", async ({ page }) => {
    await page.goto("/cursos/python");
    const intro = (await page.locator("main > div").first().textContent()) ?? "";

    const enEspanol = Number((intro.match(/Hay ([\d.]+) cursos?/) ?? [])[1]?.replace(/\./g, ""));
    expect(enEspanol).toBeGreaterThan(0);
    expect(intro).toMatch(/contando todos los idiomas/);
    expect(intro).toMatch(/valoración media de [\d,]+ sobre 5/);
    expect(intro).toMatch(/La duración típica ronda/);

    // Las páginas del listado suman exactamente los cursos que dice el texto.
    let listados = 0;
    for (let pagina = 1; pagina <= 10; pagina++) {
      await page.goto(`/cursos/python${pagina > 1 ? `?pagina=${pagina}` : ""}`);
      const enEsta = await page.locator("main ul li").count();
      listados += enEsta;
      if (enEsta === 0 || !(await page.getByRole("link", { name: "Siguiente →" }).count())) break;
    }
    expect(listados).toBe(enEspanol);
  });

  test("tiene título y descripción propios, es canónica de sí misma e indexable", async ({ page }) => {
    await page.goto("/cursos/inteligencia-artificial");

    expect(await page.title()).toMatch(/^Cursos de inteligencia artificial en español/);
    const descripcion = (await cabecera(page, 'meta[name="description"]')) ?? "";
    expect(descripcion).toMatch(/cursos de inteligencia artificial en español/);
    expect(descripcion.length).toBeLessThanOrEqual(160);
    expect(await cabecera(page, 'link[rel="canonical"]', "href")).toMatch(/\/cursos\/inteligencia-artificial$/);
    await expect(page.locator('head meta[name="robots"]')).toHaveCount(0);
  });

  test("ni el título, ni la descripción, ni el texto propio prometen «gratis»", async ({ page }) => {
    for (const tema of ["excel", "python", "fotografia"]) {
      await page.goto(`/cursos/${tema}`);
      expect(await page.title()).not.toMatch(/gratis/i);
      expect((await cabecera(page, 'meta[name="description"]')) ?? "").not.toMatch(/gratis/i);
      expect((await textoPropio(page)).join(" ")).not.toMatch(/gratis/i);
    }
  });

  test("un curso con una palabra parecida pero de otro tema no se cuela", async ({ page }) => {
    await page.goto("/cursos/sap");
    const deSap = await page.locator("main ul li h2").allTextContents();
    expect(deSap.length).toBeGreaterThan(0);
    for (const titulo of deSap) {
      expect(titulo).toMatch(/(?<![\p{L}\p{N}])sap(?![\p{L}\p{N}])/iu);
      expect(titulo).not.toMatch(/SAP-C0\d/i);
    }

    await page.goto("/cursos/ciberseguridad");
    for (const titulo of await page.locator("main ul li h2").allTextContents()) {
      expect(titulo).not.toMatch(/growth hacking/i);
    }
  });

  test("con más cursos de los que caben, la página siguiente tiene su dirección y es canónica de sí misma", async ({
    page,
  }) => {
    await page.goto("/cursos/inteligencia-artificial");
    const primeroDeLaUno = await page.locator("main ul li h2").first().textContent();

    await page.getByRole("link", { name: "Siguiente →" }).click();
    await expect(page).toHaveURL(/\/cursos\/inteligencia-artificial\?pagina=2$/);
    await expect(page.getByText("Página 2")).toBeVisible();
    expect(await page.locator("main ul li h2").first().textContent()).not.toBe(primeroDeLaUno);
    expect(await cabecera(page, 'link[rel="canonical"]', "href")).toMatch(/\/cursos\/inteligencia-artificial\?pagina=2$/);
  });

  test("un tema que no está en la lista lleva a «no encontrado» en castellano", async ({ page }) => {
    for (const ruta of ["/cursos/javascript", "/cursos/Python"]) {
      const respuesta = await page.goto(ruta);
      expect(respuesta?.status(), ruta).toBe(404);
      await expect(page.getByRole("heading", { name: "Tema no encontrado" })).toBeVisible();
    }
  });

  test("hay un enlace al buscador con esa palabra clave, para ver otros idiomas", async ({ page }) => {
    await page.goto("/cursos/excel");
    await page.getByRole("link", { name: "Buscar también en otros idiomas" }).click();

    await expect(page).toHaveURL(/\/buscar\?keyword=Excel$/);
    await expect(page.getByLabel("Palabra clave")).toHaveValue("Excel");
  });

  test("el sitemap incluye las páginas de tema, y todas son indexables", async ({ page, request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    const temas = [...xml.matchAll(/<loc>[^<]*(\/cursos\/[a-z0-9-]+)<\/loc>/g)].map((m) => m[1]);

    expect(temas).toContain("/cursos/python");
    expect(temas).toContain("/cursos/desarrollo-web");
    for (const ruta of temas.slice(0, 5)) {
      const respuesta = await page.goto(ruta);
      expect(respuesta?.status(), ruta).toBe(200);
      await expect(page.locator('head meta[name="robots"]'), ruta).toHaveCount(0);
    }
  });

  test("declara sus migas de pan con direcciones absolutas", async ({ page }) => {
    await page.goto("/cursos/power-bi");
    const bloques = await page.locator('script[type="application/ld+json"]').allTextContents();
    const migas = bloques.map((b) => JSON.parse(b)).find((d) => d["@type"] === "BreadcrumbList");

    expect(migas?.itemListElement.map((i: { item: string }) => i.item)).toEqual([
      "https://gourses.com/",
      "https://gourses.com/cursos/power-bi",
    ]);
  });
});
