import { expect, test, type Page } from "@playwright/test";

// Un test por criterio de aceptación de HU-046.

const metaDescripcion = (page: Page) =>
  page.locator('head meta[name="description"]').getAttribute("content");
const canonica = (page: Page) => page.locator('head link[rel="canonical"]').getAttribute("href");

test.describe("HU-046 — páginas por categoría", () => {
  test("la categoría tiene su propia página, con sus cursos y su titular", async ({ page }) => {
    await page.goto("/categoria/diseno-y-creatividad");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Cursos de Diseño y creatividad"
    );
    await expect(page.locator("main li").first()).toBeVisible();
    expect(await page.title()).toContain("Cursos de Diseño y creatividad");
  });

  test("sus metadatos son propios y se declara canónica de sí misma", async ({ page }) => {
    await page.goto("/categoria/idiomas");
    const descripcionIdiomas = await metaDescripcion(page);
    expect(descripcionIdiomas).toMatch(/de Idiomas de Udemy y Coursera/);
    expect(await canonica(page)).toMatch(/\/categoria\/idiomas$/);

    // Y no son los mismos que los de otra categoría, que es el fallo que esta
    // historia viene a arreglar.
    await page.goto("/categoria/negocios");
    expect(await metaDescripcion(page)).not.toBe(descripcionIdiomas);
    expect(await canonica(page)).toMatch(/\/categoria\/negocios$/);
  });

  test("se puede pasar de página, y esa página también es compartible", async ({
    page,
    context,
  }) => {
    await page.goto("/categoria/negocios");
    const primeroEnLaUno = await page.locator("main li h2 a").first().textContent();

    await page.getByRole("link", { name: "Siguiente" }).click();

    await expect(page).toHaveURL(/\/categoria\/negocios\?pagina=2$/);
    await expect(page.getByText("Página 2")).toBeVisible();
    const primeroEnLaDos = await page.locator("main li h2 a").first().textContent();
    expect(primeroEnLaDos).not.toBe(primeroEnLaUno);

    const otra = await context.newPage();
    await otra.goto("/categoria/negocios?pagina=2");
    expect(await otra.locator("main li h2 a").first().textContent()).toBe(primeroEnLaDos);
    await otra.close();
  });

  test("desde la categoría se salta al buscador con ella ya aplicada", async ({ page }) => {
    await page.goto("/categoria/it-y-software");

    await page.getByRole("link", { name: "Afinar la búsqueda" }).click();

    await expect(page).toHaveURL(/\/buscar\?category=it-y-software$/);
    await expect(page.getByLabel("Categoría")).toHaveValue("it-y-software");
  });

  test("una categoría inventada lleva a «no encontrado», no a una página vacía", async ({
    page,
  }) => {
    const respuesta = await page.goto("/categoria/no-existe-esta");

    expect(respuesta?.status()).toBe(404);
    await expect(page.locator("body")).toContainText(/no.*encontr/i);
    await expect(page.getByRole("heading", { name: /Cursos de/ })).toHaveCount(0);
  });

  test("la portada lleva a la página de la categoría, no al buscador", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Desarrollo", exact: true }).click();

    await expect(page).toHaveURL(/\/categoria\/desarrollo$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cursos de Desarrollo");
  });

  test("el sitemap incluye las once categorías", async ({ page }) => {
    const respuesta = await page.request.get("/sitemap.xml");
    const xml = await respuesta.text();

    for (const slug of [
      "desarrollo",
      "it-y-software",
      "datos-e-ia",
      "negocios",
      "diseno-y-creatividad",
      "desarrollo-personal",
      "salud-y-bienestar",
      "ciencia-y-matematicas",
      "humanidades-y-sociales",
      "idiomas",
      "productividad",
    ]) {
      expect(xml).toContain(`/categoria/${slug}<`);
    }
  });
});
