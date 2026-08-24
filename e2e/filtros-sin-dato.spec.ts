import { expect, test, type Page } from "@playwright/test";

// Un test por criterio de aceptación de HU-026.
//
// El fallo que motiva la historia: escribir un precio máximo hacía desaparecer
// los 4.000 cursos de Coursera —casi medio catálogo— sin decir nada, porque en
// SQL `price_amount <= 20` es NULL cuando no hay precio.

const aviso = (page: Page) => page.getByText(/quedan fuera de esta búsqueda/i);
const incluir = (page: Page) => page.getByRole("link", { name: /Incluirlos de todos modos/i });

// La primera palabra de la línea de datos de cada curso es su plataforma.
async function plataformas(page: Page): Promise<string[]> {
  return page
    .locator("main li p")
    .evaluateAll((ps) => ps.map((p) => (p.textContent ?? "").trim().split(" ")[0].toLowerCase()));
}

test.describe("HU-026 — filtrar sin borrar media web", () => {
  test("con precio máximo se avisa de lo que queda fuera y de cómo incluirlo", async ({
    page,
  }) => {
    await page.goto("/buscar?maxPrice=20");

    await expect(aviso(page)).toBeVisible();
    await expect(aviso(page)).toContainText("precio");
    await expect(incluir(page)).toBeVisible();

    // Y de hecho está pasando: no hay ni un curso de Coursera.
    expect(await plataformas(page)).not.toContain("coursera");
  });

  test("al incluirlos vuelven los cursos de Coursera junto a los que cumplen el precio", async ({
    page,
  }) => {
    await page.goto("/buscar?maxPrice=20");
    await incluir(page).click();
    // Esperar por la dirección, no por texto: «Página 1» está visible en las dos
    // páginas, así que esperar por él no espera a nada.
    await page.waitForURL(/sinDato=1/);

    const fuentes = await plataformas(page);
    expect(fuentes).toContain("coursera");
    expect(fuentes).toContain("udemy");

    // Incluir los que no tienen dato no puede volverse «no filtrar»: los que sí
    // publican precio siguen respetando el máximo.
    const precios = await page
      .locator("main li p")
      .evaluateAll((ps) =>
        ps
          .map((p) => /·\s*([\d.]+)\s+[A-Z]{3}/.exec(p.textContent ?? ""))
          .filter((m): m is RegExpExecArray => m !== null)
          .map((m) => Number(m[1]))
      );

    expect(precios.length).toBeGreaterThan(0);
    expect(precios.every((p) => p <= 20)).toBe(true);
  });

  test("con valoración mínima se avisa igual, porque Coursera tampoco la publica", async ({
    page,
  }) => {
    await page.goto("/buscar?minRating=4");

    await expect(aviso(page)).toBeVisible();
    await expect(aviso(page)).toContainText("valoración");
    expect(await plataformas(page)).not.toContain("coursera");
  });

  test("sin filtro de precio ni de valoración no se avisa de nada", async ({ page }) => {
    await page.goto("/buscar?keyword=python");

    await expect(page.locator("main li h2 a").first()).toBeVisible();
    await expect(aviso(page)).toHaveCount(0);
  });

  test("la elección de incluirlos sobrevive al pasar de página", async ({ page }) => {
    await page.goto("/buscar?maxPrice=20");
    await incluir(page).click();
    await page.waitForURL(/sinDato=1/);

    await page.getByRole("link", { name: "Siguiente" }).click();
    await expect(page.getByText("Página 2")).toBeVisible();

    expect(page.url()).toContain("sinDato=1");
    expect(page.url()).toContain("maxPrice=20");
    // Y sigue surtiendo efecto, no solo estando en la dirección.
    await expect(aviso(page)).toHaveCount(0);
    expect(await plataformas(page)).toContain("coursera");
  });
});
