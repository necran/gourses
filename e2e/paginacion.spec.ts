import { expect, test, type Page } from "@playwright/test";

// Un test por criterio de aceptación de HU-025.
//
// Antes de esta historia el buscador enseñaba como mucho 50 cursos de los 8.796
// del catálogo, sin ninguna forma de llegar al 51.

const titulos = (page: Page) => page.locator("main li h2 a");
const siguiente = (page: Page) => page.getByRole("link", { name: "Siguiente" });
const anterior = (page: Page) => page.getByRole("link", { name: "Anterior" });

async function titulosDe(page: Page): Promise<string[]> {
  return (await titulos(page).allTextContents()).map((t) => t.trim());
}

test.describe("HU-025 — paginación del buscador", () => {
  test("con más resultados de los que caben, se ve cómo pasar a la siguiente", async ({
    page,
  }) => {
    await page.goto("/buscar");

    await expect(titulos(page).first()).toBeVisible();
    await expect(page.getByText("Página 1")).toBeVisible();
    await expect(siguiente(page)).toBeVisible();
  });

  test("la página siguiente trae cursos distintos, sin repetir", async ({ page }) => {
    await page.goto("/buscar");
    const primera = await titulosDe(page);
    expect(primera.length).toBeGreaterThan(0);

    await siguiente(page).click();
    await expect(page.getByText("Página 2")).toBeVisible();

    const segunda = await titulosDe(page);
    expect(segunda.length).toBeGreaterThan(0);

    const repetidos = segunda.filter((t) => primera.includes(t));
    expect(repetidos).toEqual([]);
  });

  test("la dirección de la página 2 se puede compartir y devuelve la página 2", async ({
    page,
  }) => {
    await page.goto("/buscar");
    await siguiente(page).click();
    // Esperar a que la navegación haya ocurrido antes de leer la dirección: sin
    // esto se lee la de la página anterior y el test miente.
    await expect(page.getByText("Página 2")).toBeVisible();

    const direccion = page.url();
    expect(direccion).toContain("pagina=2");

    const esperados = await titulosDe(page);

    // Se abre de cero, como quien recibe el enlace: sin historial ni estado.
    await page.goto(direccion);

    await expect(page.getByText("Página 2")).toBeVisible();
    expect(await titulosDe(page)).toEqual(esperados);
  });

  test("al pasar de página los filtros siguen aplicados", async ({ page }) => {
    await page.goto("/buscar?category=desarrollo");
    const primera = await titulosDe(page);
    expect(primera.length).toBeGreaterThan(0);

    await siguiente(page).click();

    // El filtro se ve en la dirección, en el formulario y en los resultados:
    // los tres, porque perder cualquiera de ellos rompe la búsqueda.
    expect(page.url()).toContain("category=desarrollo");
    await expect(page.getByLabel("Categoría")).toHaveValue("desarrollo");
    await expect(titulos(page).first()).toBeVisible();
  });

  test("la página siguiente sigue trayendo las dos plataformas", async ({ page }) => {
    await page.goto("/buscar");
    await siguiente(page).click();
    await expect(page.getByText("Página 2")).toBeVisible();

    const fuentes = await page
      .locator("main li p")
      .evaluateAll((ps) =>
        ps.map((p) => (p.textContent ?? "").trim().split(" ")[0].toLowerCase())
      );

    expect(fuentes).toContain("udemy");
    expect(fuentes).toContain("coursera");
  });

  test("un número de página inventado no rompe el buscador", async ({ page }) => {
    // Basura: se vuelve a la primera y se ven cursos.
    for (const raw of ["0", "-3", "abc", "2.5", "%20"]) {
      await page.goto(`/buscar?pagina=${raw}`);

      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Buscar cursos");
      await expect(page.getByText("Página 1")).toBeVisible();
      await expect(titulos(page).first()).toBeVisible();
    }

    // Un número enorme sí es una página, solo que más allá del catálogo. Se
    // recorta al tope y se dice que ahí no hay nada, con la salida a mano: no
    // se finge que estás en la última página con resultados.
    await page.goto("/buscar?pagina=99999999999");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Buscar cursos");
    await expect(page.getByText("Esta página ya no tiene resultados")).toBeVisible();
    await expect(page.getByRole("link", { name: "Volver a la primera" })).toBeVisible();
  });

  test("desde la primera página no se ofrece «Anterior»", async ({ page }) => {
    await page.goto("/buscar");

    await expect(anterior(page)).toHaveCount(0);
  });
});
