import { expect, test } from "@playwright/test";

test.describe("HU-016 — SEO de las fichas", () => {
  // Recoge los identificadores de dos cursos distintos desde el buscador.
  async function dosFichas(page: import("@playwright/test").Page): Promise<string[]> {
    await page.goto("/buscar");
    const enlaces = page.locator("main li h2 a");
    const a = await enlaces.nth(0).getAttribute("href");
    const b = await enlaces.nth(1).getAttribute("href");
    return [a!, b!];
  }

  test("cada ficha tiene su propio título, distinto del genérico del sitio", async ({ page }) => {
    const [uno, dos] = await dosFichas(page);

    await page.goto(uno);
    const tituloUno = await page.title();
    await page.goto(dos);
    const tituloDos = await page.title();

    expect(tituloUno).not.toBe(tituloDos);
    // El título genérico de la portada no debe heredarse en las fichas.
    expect(tituloUno).not.toMatch(/^Gourses — Compara cursos online/);
    expect(tituloUno).toMatch(/udemy|coursera/i);
  });

  test("cada ficha tiene su propia descripción", async ({ page }) => {
    const [uno, dos] = await dosFichas(page);

    const descripcion = async (ruta: string) => {
      await page.goto(ruta);
      return page.locator('meta[name="description"]').getAttribute("content");
    };

    const a = await descripcion(uno);
    const b = await descripcion(dos);

    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });

  test("la ficha publica datos estructurados de curso válidos", async ({ page }) => {
    const [uno] = await dosFichas(page);
    await page.goto(uno);

    const json = await page.locator('script[type="application/ld+json"]').textContent();
    expect(json).toBeTruthy();

    const datos = JSON.parse(json!);
    expect(datos["@type"]).toBe("Course");
    expect(datos.name).toBeTruthy();
    expect(datos.provider?.name).toMatch(/Udemy|Coursera/);

    // Nunca debe declarar un precio vacío o inventado.
    if (datos.offers) {
      expect(typeof datos.offers.price).toBe("number");
      expect(datos.offers.priceCurrency).toMatch(/^[A-Z]{3}$/);
    }
  });

  test("robots.txt permite el rastreo y apunta al sitemap", async ({ page }) => {
    const res = await page.request.get("/robots.txt");
    expect(res.status()).toBe(200);

    const texto = await res.text();
    expect(texto).toMatch(/Allow: \//);
    expect(texto).toMatch(/Sitemap:.*sitemap\.xml/);
  });

  test("el sitemap incluye las páginas principales y fichas de curso", async ({ page }) => {
    const res = await page.request.get("/sitemap.xml");
    expect(res.status()).toBe(200);

    const xml = await res.text();
    expect(xml).toContain("/buscar");
    expect(xml).toContain("/afiliacion");

    // Debe listar fichas reales, no solo las páginas fijas. El umbral de
    // 1.000 no es arbitrario: es el tope de filas por respuesta de PostgREST
    // en este proyecto, que un `.limit()` más alto no sorteaba — con eso el
    // sitemap se quedaba callado en 1.000 fichas pasara lo que pasara, y
    // nadie lo notaba porque un sitemap corto no da ningún error (HU-029).
    const fichas = xml.match(/\/curso\/[0-9a-f-]{36}/g) ?? [];
    expect(fichas.length).toBeGreaterThan(1000);
  });
});
