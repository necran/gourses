import { expect, test, type Page } from "@playwright/test";

// Un test por criterio de aceptación de HU-056.

const cabecera = (page: Page, selector: string, atributo = "content") =>
  page.locator(`head ${selector}`).first().getAttribute(atributo);

// Solo los campos que miran estos tests.
interface NodoLd {
  "@type"?: string;
  "@graph"?: NodoLd[];
  potentialAction?: { "@type"?: string; target?: { urlTemplate?: string } };
  itemListElement?: Array<{ item?: string; name?: string }>;
}

async function datosEstructurados(page: Page): Promise<NodoLd[]> {
  const bloques = await page.locator('script[type="application/ld+json"]').allTextContents();
  return bloques.map((b) => JSON.parse(b) as NodoLd);
}

test.describe("HU-056 — SEO técnico", () => {
  test("/buscar tiene cabecera propia y las búsquedas concretas no se indexan", async ({ page }) => {
    await page.goto("/buscar");
    expect(await page.title()).toMatch(/^Buscar cursos/);
    expect(await cabecera(page, 'link[rel="canonical"]', "href")).toMatch(/\/buscar$/);
    await expect(page.locator('head meta[name="robots"]')).toHaveCount(0);

    await page.goto("/buscar?keyword=python&maxPrice=20&pagina=2");
    expect(await cabecera(page, 'meta[name="robots"]')).toMatch(/noindex/);
    expect(await cabecera(page, 'meta[name="robots"]')).toMatch(/(?<!no)follow/);
    expect(await cabecera(page, 'link[rel="canonical"]', "href")).toMatch(/\/buscar$/);
  });

  test("la página 2 de una categoría es canónica de sí misma", async ({ page }) => {
    await page.goto("/categoria/negocios?pagina=2");
    expect(await cabecera(page, 'link[rel="canonical"]', "href")).toMatch(
      /\/categoria\/negocios\?pagina=2$/
    );
  });

  test("portada y categorías se comparten con imagen grande; la ficha, con la del curso", async ({
    page,
  }) => {
    for (const ruta of ["/", "/categoria/desarrollo"]) {
      await page.goto(ruta);
      const imagen = await cabecera(page, 'meta[property="og:image"]');
      expect(imagen, ruta).toMatch(/\/imagen-compartir\.png$/);
      expect(await cabecera(page, 'meta[property="og:image:width"]'), ruta).toBe("1200");
      expect(await cabecera(page, 'meta[property="og:image:height"]'), ruta).toBe("630");
      expect(await cabecera(page, 'meta[name="twitter:card"]'), ruta).toBe("summary_large_image");

      const respuesta = await page.request.get(new URL(imagen!).pathname + new URL(imagen!).search);
      expect(respuesta.status(), ruta).toBe(200);
      expect(respuesta.headers()["content-type"], ruta).toContain("image/png");
    }

    await page.goto("/buscar");
    const ficha = (await page.locator("main li:has(img) h2 a").first().getAttribute("href"))!;
    const miniatura = await page.locator("main li:has(img) img").first().getAttribute("src");
    await page.goto(ficha);
    expect(await cabecera(page, 'meta[property="og:image"]')).toBe(miniatura);
  });

  test("la portada declara el sitio con su buscador y la organización", async ({ page }) => {
    await page.goto("/");
    const nodos = (await datosEstructurados(page)).flatMap((d) => d["@graph"] ?? [d]);

    const sitio = nodos.find((n) => n["@type"] === "WebSite");
    expect(sitio?.potentialAction?.["@type"]).toBe("SearchAction");
    expect(sitio?.potentialAction?.target?.urlTemplate).toContain("/buscar?keyword={search_term_string}");
    expect(nodos.some((n) => n["@type"] === "Organization")).toBe(true);
  });

  test("ficha y categoría declaran sus migas de pan con direcciones absolutas", async ({ page }) => {
    await page.goto("/categoria/desarrollo");
    const deCategoria = (await datosEstructurados(page)).find((d) => d["@type"] === "BreadcrumbList");
    expect(deCategoria?.itemListElement?.map((i) => i.item)).toEqual([
      "https://gourses.com/",
      "https://gourses.com/categoria/desarrollo",
    ]);

    await page.goto("/buscar");
    const href = (await page.locator("main li:has(img) h2 a").first().getAttribute("href"))!;
    await page.goto(href);
    const deFicha = (await datosEstructurados(page)).find((d) => d["@type"] === "BreadcrumbList");
    const elementos = deFicha?.itemListElement ?? [];
    expect(elementos[0]?.item).toBe("https://gourses.com/");
    expect(elementos.at(-1)?.item).toBe(`https://gourses.com${href}`);
    expect(elementos.at(-1)?.name).toBe(await page.getByRole("heading", { level: 1 }).textContent());
  });

  test("la portada enlaza las once categorías", async ({ page }) => {
    await page.goto("/");
    const destinos = await page
      .locator('main a[href^="/categoria/"]')
      .evaluateAll((enlaces) => [...new Set(enlaces.map((a) => a.getAttribute("href")))]);
    expect(destinos).toHaveLength(11);
  });

  test("las fichas del sitemap no declaran una fecha de modificación diaria", async ({ page }) => {
    const xml = await (await page.request.get("/sitemap.xml")).text();
    const fichas = xml.match(/<url>\s*<loc>[^<]*\/curso\/[\s\S]*?<\/url>/g) ?? [];

    expect(fichas.length).toBeGreaterThan(1000);
    expect(fichas.filter((f) => f.includes("<lastmod>"))).toEqual([]);
  });
});
