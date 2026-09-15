import { expect, test, type Page } from "@playwright/test";

// HU-050. Un test por criterio de aceptación que se puede comprobar en el
// navegador. Los dos del sitemap cacheado (que la segunda petición salga de la
// caché y que se regenere al día) no: en `next dev` todo se renderiza bajo
// demanda y nunca se cachea, así que se comprueban midiendo una compilación de
// producción en local, y el resultado queda anotado en la historia.

// Mismo número que MINIATURAS_INMEDIATAS en src/lib/imagenes.ts.
const INMEDIATAS = 4;

// `posicion` es la de la tarjeta dentro de su lista, no la de la imagen entre
// las imágenes: hay cursos sin miniatura, y el código decide por la tarjeta. Si
// se contaran imágenes, una tarjeta sin imagen arriba desplazaría la cuenta y
// la quinta tarjeta pasaría por cuarta (pasó con los cursos que siembra HU-032
// mientras corre la suite completa).
async function atributosDeImagenes(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((imagenes) =>
    (imagenes as HTMLImageElement[]).map((img) => ({
      posicion: (() => {
        const tarjeta = img.closest("li");
        return tarjeta?.parentElement ? [...tarjeta.parentElement.children].indexOf(tarjeta) : -1;
      })(),
      loading: img.getAttribute("loading"),
      fetchpriority: img.getAttribute("fetchpriority"),
      width: img.getAttribute("width"),
      height: img.getAttribute("height"),
    }))
  );
}

function comprobarCarga(imagenes: Awaited<ReturnType<typeof atributosDeImagenes>>) {
  expect(imagenes.some((img) => img.posicion >= INMEDIATAS)).toBe(true);
  for (const img of imagenes) {
    const esperado = img.posicion < INMEDIATAS ? "eager" : "lazy";
    expect(img.loading, `tarjeta ${img.posicion}`).toBe(esperado);
  }
}

test.describe("HU-050 — rendimiento: imágenes y sitemap", () => {
  test("en el buscador, las primeras miniaturas cargan de inmediato y el resto en diferido", async ({
    page,
  }) => {
    await page.goto("/buscar");
    comprobarCarga(await atributosDeImagenes(page, "main li img"));
  });

  test("en la portada pasa lo mismo con los cursos destacados", async ({ page }) => {
    await page.goto("/");
    comprobarCarga(await atributosDeImagenes(page, "main li img"));
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
