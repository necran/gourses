import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { COURSE_CATEGORIES } from "../src/lib/courses/categories";
import { CATEGORIAS_EN_PORTADA, TEMAS_EN_PORTADA } from "../src/lib/courses/portada";

// Un test por criterio de aceptación de HU-070.

const enlacesA = (page: Page, prefijo: string) =>
  page.locator(`main a[href^="${prefijo}"]`).evaluateAll((as) => [
    ...new Set(as.map((a) => a.getAttribute("href")!)),
  ]);

async function unCursoConEnlace(): Promise<string> {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  try {
    const { rows } = await pg.query(
      `select id from courses where affiliate_url is not null and price_amount is not null
        order by num_reviews desc nulls last, id limit 1`
    );
    return rows[0].id;
  } finally {
    await pg.end();
  }
}

test.describe("HU-070 — portada más corta y botones alineados", () => {
  test("la portada enseña unas pocas categorías y temas, con enlace a verlos todos", async ({
    page,
  }) => {
    await page.goto("/");

    const categorias = await enlacesA(page, "/categoria/");
    expect(categorias).toHaveLength(CATEGORIAS_EN_PORTADA);
    await expect(page.getByRole("link", { name: "Ver todas las categorías →" })).toHaveAttribute(
      "href",
      "/categoria"
    );

    const temas = await enlacesA(page, "/cursos/");
    expect(temas.length).toBeLessThanOrEqual(TEMAS_EN_PORTADA);
    expect(temas.length).toBeGreaterThan(0);
    await expect(page.getByRole("link", { name: "Ver todos los temas →" })).toHaveAttribute(
      "href",
      "/cursos"
    );
  });

  test("el índice de categorías tiene las once, cada una con su página", async ({ page, request }) => {
    await page.goto("/categoria");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Todas las categorías de cursos");

    const destinos = await enlacesA(page, "/categoria/");
    expect(destinos).toHaveLength(COURSE_CATEGORIES.length);
    for (const categoria of COURSE_CATEGORIES) {
      expect(destinos, categoria).toContain(`/categoria/${categoria}`);
    }
    expect((await request.get(destinos[0])).status()).toBe(200);
  });

  test("el índice de temas los agrupa por categoría y lleva a cada uno", async ({ page, request }) => {
    await page.goto("/cursos");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Todos los temas con cursos en español"
    );

    const grupos = await page.getByRole("heading", { level: 2 }).count();
    expect(grupos).toBeGreaterThan(0);

    const temas = await enlacesA(page, "/cursos/");
    expect(temas.length).toBeGreaterThan(TEMAS_EN_PORTADA);
    expect((await request.get(temas[0])).status()).toBe(200);
  });

  test("ninguna categoría pierde su enlace: la portada lleva al índice y el índice a las once", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Ver todas las categorías →" }).click();
    await expect(page).toHaveURL(/\/categoria$/);
    expect(await enlacesA(page, "/categoria/")).toHaveLength(COURSE_CATEGORIES.length);
  });

  test("en la ficha, favoritos y comparar van en su fila y alineados entre sí", async ({ page }) => {
    await page.goto(`/curso/${await unCursoConEnlace()}`);

    const principal = page.getByRole("link", { name: /^Ver curso en/ });
    const comparar = page.getByRole("button", { name: /comparaci[óo]n|comparar/i }).first();
    // Sin sesión, «favoritos» no es un botón sino la invitación a acceder
    // («Entra en tu cuenta para guardar este curso…»): es justo el caso que se
    // veía torcido, y tiene que alinearse igual con el chip de comparar.
    const favoritos = page
      .getByText(/Entra en tu cuenta para guardar|Guardar en favoritos|Quitar de favoritos/i)
      .first();

    const [cajaPrincipal, cajaComparar, cajaFavoritos] = await Promise.all([
      principal.boundingBox(),
      comparar.boundingBox(),
      favoritos.boundingBox(),
    ]);
    expect(cajaPrincipal && cajaComparar && cajaFavoritos).toBeTruthy();

    // Debajo del botón principal, no a su lado a media altura.
    expect(cajaComparar!.y).toBeGreaterThan(cajaPrincipal!.y + cajaPrincipal!.height - 1);
    // Y los dos secundarios, centrados sobre la misma línea.
    const centro = (c: { y: number; height: number }) => c.y + c.height / 2;
    expect(Math.abs(centro(cajaComparar!) - centro(cajaFavoritos!))).toBeLessThanOrEqual(2);
  });

  test("los dos índices tienen metadatos propios, canónica, migas de pan y están en el sitemap", async ({
    page,
    request,
  }) => {
    for (const [ruta, titulo] of [
      ["/categoria", /^Todas las categorías/],
      ["/cursos", /^Todos los temas/],
    ] as const) {
      await page.goto(ruta);
      await expect(page).toHaveTitle(titulo);
      expect(
        await page.locator('head meta[name="description"]').first().getAttribute("content")
      ).toBeTruthy();
      expect(
        await page.locator('head link[rel="canonical"]').first().getAttribute("href")
      ).toMatch(new RegExp(`${ruta}$`));

      const bloques = await page.locator('script[type="application/ld+json"]').allTextContents();
      const migas = bloques.map((b) => JSON.parse(b)).find((d) => d["@type"] === "BreadcrumbList");
      expect(migas.itemListElement.at(-1).item, ruta).toMatch(new RegExp(`${ruta}$`));
    }

    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toMatch(/<loc>[^<]*\/categoria<\/loc>/);
    expect(sitemap).toMatch(/<loc>[^<]*\/cursos<\/loc>/);
  });
});
