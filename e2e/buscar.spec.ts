import { expect, test } from "@playwright/test";

test.describe("HU-007 — buscador de cursos", () => {
  test("la carga inicial sin filtros muestra un listado por defecto", async ({ page }) => {
    await page.goto("/buscar");

    await expect(page.getByRole("heading", { level: 1, name: "Buscar cursos" })).toBeVisible();
    await expect(page.locator("main li")).not.toHaveCount(0);
  });

  test("buscar por palabra clave muestra cursos cuyo título o descripción coincide", async ({
    page,
  }) => {
    await page.goto("/buscar");

    await page.getByLabel("Palabra clave").fill("python");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page).toHaveURL(/keyword=python/);
    const items = page.locator("main li");
    await expect(items.first()).toBeVisible();

    const text = (await items.allTextContents()).join(" ").toLowerCase();
    expect(text).toContain("python");
  });

  test("aplicar un filtro de precio máximo actualiza la lista respetando el límite", async ({
    page,
  }) => {
    await page.goto("/buscar");
    const unfilteredCount = await page.locator("main li").count();

    await page.getByLabel("Precio máximo").fill("20");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page).toHaveURL(/maxPrice=20/);

    const filteredCount = await page.locator("main li").count();
    expect(filteredCount).toBeLessThan(unfilteredCount);

    const metaTexts = await page.locator("main li p").allTextContents();
    for (const line of metaTexts) {
      const match = line.match(/·\s*([\d.]+)\s+\w+/);
      if (match) {
        expect(Number(match[1])).toBeLessThanOrEqual(20);
      }
    }
  });

  test("una búsqueda sin resultados muestra un mensaje claro, nunca una lista vacía sin explicación", async ({
    page,
  }) => {
    await page.goto("/buscar");

    await page.getByLabel("Palabra clave").fill("zzz-no-existe-ningun-curso-asi-nunca-jamas");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page.getByRole("status")).toHaveText(
      "No se han encontrado cursos con esos criterios."
    );
    await expect(page.locator("main li")).toHaveCount(0);
  });
});
