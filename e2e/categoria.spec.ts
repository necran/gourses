import { expect, test } from "@playwright/test";

// Un test por criterio de aceptación de HU-022.
//
// El bug que motivó la historia: las seis categorías de la portada llevaban a
// una página vacía, porque enlazaban a una búsqueda de texto con la etiqueta en
// español contra un catálogo en inglés.

const cursos = (page: import("@playwright/test").Page) => page.locator("main li h2 a");

test.describe("HU-022 — filtrar por categoría", () => {
  test("cada categoría de la portada lleva a cursos, no a una página vacía", async ({ page }) => {
    await page.goto("/");

    // Hay que quedarse con las direcciones ANTES de navegar: al salir de la
    // portada el localizador deja de resolver y el bucle se cuelga.
    const enlaces = await page
      .locator("main a[href^='/buscar?category=']")
      .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!));

    expect(enlaces.length).toBeGreaterThan(0);

    // Todas, no solo la primera: el fallo afectaba a las seis por igual.
    for (const href of enlaces) {
      await page.goto(href);

      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Buscar cursos");
      await expect(cursos(page).first()).toBeVisible();
    }
  });

  test("la categoría aplicada se ve seleccionada en el buscador", async ({ page }) => {
    await page.goto("/buscar?category=datos-e-ia");

    await expect(page.getByLabel("Categoría")).toHaveValue("datos-e-ia");
  });

  test("volver a «todas» devuelve el catálogo completo", async ({ page }) => {
    await page.goto("/buscar?category=idiomas");
    const conFiltro = await cursos(page).count();

    await page.getByLabel("Categoría").selectOption("");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page.getByLabel("Categoría")).toHaveValue("");
    expect(await cursos(page).count()).toBeGreaterThan(conFiltro);
  });

  test("una categoría inventada se ignora, sin error", async ({ page }) => {
    await page.goto("/buscar?category=no-existe-esta-categoria");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Buscar cursos");
    await expect(cursos(page).first()).toBeVisible();
    // Se ignora del todo: el selector queda en «todas».
    await expect(page.getByLabel("Categoría")).toHaveValue("");
  });

  test("categoría y palabra clave se aplican a la vez", async ({ page }) => {
    await page.goto("/buscar?category=desarrollo");
    const soloCategoria = await cursos(page).count();
    expect(soloCategoria).toBeGreaterThan(0);

    await page.goto("/buscar?category=desarrollo&keyword=python");
    const ambos = await cursos(page).count();

    expect(ambos).toBeLessThanOrEqual(soloCategoria);
    await expect(page.getByLabel("Categoría")).toHaveValue("desarrollo");
  });
});
