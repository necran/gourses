import { expect, test, type Page } from "@playwright/test";

// HU-050. Un test por criterio de aceptación que se puede comprobar en el
// navegador. Los dos del sitemap cacheado (que la segunda petición salga de la
// caché y que se regenere al día) no: en `next dev` todo se renderiza bajo
// demanda y nunca se cachea, así que se comprueban midiendo una compilación de
// producción en local, y el resultado queda anotado en la historia.

// Mismo número que MINIATURAS_INMEDIATAS en src/lib/imagenes.ts.
const INMEDIATAS = 4;

async function atributosDeImagenes(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((imagenes) =>
    (imagenes as HTMLImageElement[]).map((img) => ({
      loading: img.getAttribute("loading"),
      fetchpriority: img.getAttribute("fetchpriority"),
      width: img.getAttribute("width"),
      height: img.getAttribute("height"),
    }))
  );
}

test.describe("HU-050 — rendimiento: imágenes y sitemap", () => {
  test("en el buscador, las primeras miniaturas cargan de inmediato y el resto en diferido", async ({
    page,
  }) => {
    await page.goto("/buscar");
    const imagenes = await atributosDeImagenes(page, "main li img");

    expect(imagenes.length).toBeGreaterThan(INMEDIATAS);
    for (const img of imagenes.slice(0, INMEDIATAS)) expect(img.loading).not.toBe("lazy");
    for (const img of imagenes.slice(INMEDIATAS)) expect(img.loading).toBe("lazy");
  });

  test("en la portada pasa lo mismo con los cursos destacados", async ({ page }) => {
    await page.goto("/");
    const imagenes = await atributosDeImagenes(page, "main li img");

    expect(imagenes.length).toBeGreaterThan(INMEDIATAS);
    for (const img of imagenes.slice(0, INMEDIATAS)) expect(img.loading).not.toBe("lazy");
    for (const img of imagenes.slice(INMEDIATAS)) expect(img.loading).toBe("lazy");
  });

  test("la imagen principal de la ficha carga de inmediato y con prioridad", async ({
    page,
  }) => {
    await page.goto("/buscar");
    const href = (await page.locator("main li h2 a").first().getAttribute("href"))!;
    await page.goto(href);

    const [principal] = await atributosDeImagenes(page, "main article header img");
    expect(principal).toBeDefined();
    expect(principal.loading).not.toBe("lazy");
    expect(principal.fetchpriority).toBe("high");
  });

  test("todas las imágenes de curso reservan su hueco antes de cargar", async ({ page }) => {
    for (const ruta of ["/buscar", "/", "/categoria/desarrollo"]) {
      await page.goto(ruta);
      const imagenes = await atributosDeImagenes(page, "main li img");
      expect(imagenes.length, ruta).toBeGreaterThan(0);
      for (const img of imagenes) {
        expect(Number(img.width), `${ruta}: sin anchura`).toBeGreaterThan(0);
        expect(Number(img.height), `${ruta}: sin altura`).toBeGreaterThan(0);
      }
    }
  });

  test("el sitemap conserva las páginas fijas, las categorías y las fichas", async ({ page }) => {
    const xml = await (await page.request.get("/sitemap.xml")).text();

    expect(xml).toContain("/privacidad<");
    expect(xml).toContain("/categoria/desarrollo<");
    // El catálogo tiene miles de fichas; con mil ya se sabe que no se ha quedado
    // en las páginas fijas por un fallo al leer la base.
    expect((xml.match(/\/curso\/[0-9a-f-]{36}</g) ?? []).length).toBeGreaterThan(1000);
  });
});
