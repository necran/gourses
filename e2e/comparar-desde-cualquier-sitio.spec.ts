import { expect, test, type Page } from "@playwright/test";

// Misma cautela que en comparar.spec.ts: tras un clic que navega, hay que
// esperar a que la URL/cabecera de la página destino aparezcan antes de leer
// nada, o el test lee todavía la página anterior por una carrera con el
// servidor de dev compilando la ruta por primera vez.

test.describe("HU-031 — empezar a comparar desde la ficha", () => {
  test("desde la ficha de un curso se puede empezar una comparación", async ({ page }) => {
    await page.goto("/buscar");
    const primerTitulo = await page.locator("main li h2 a").first().textContent();
    await page.locator("main li h2 a").first().click();

    await page.getByRole("link", { name: "Comparar este curso" }).click();

    await expect(page).toHaveURL(/\/buscar\?preseleccionado=/);
    const casillaPreseleccionada = page.locator('input[name="ids"]:checked');
    await expect(casillaPreseleccionada).toHaveCount(1);

    // Es el mismo curso del que se venía, no otro cualquiera.
    const tarjeta = page.locator("main li", { has: casillaPreseleccionada });
    await expect(tarjeta.locator("h2")).toHaveText(primerTitulo ?? "");
  });

  async function irAComparacionDeDos(page: Page): Promise<void> {
    await page.goto("/buscar");
    const casillas = page.locator('input[name="ids"]');
    await casillas.nth(0).check();
    await casillas.nth(1).check();
    await page.getByRole("button", { name: "Comparar seleccionados" }).click();
    await expect(page).toHaveURL(/\/comparar\?ids=/);
  }

  test("desde una comparación se puede añadir el curso de su ficha sin perder los demás", async ({
    page,
  }) => {
    await irAComparacionDeDos(page);
    const titulos = await page.locator("thead th a").allTextContents();
    expect(titulos).toHaveLength(2);

    await page.locator("thead th a").first().click();
    await expect(page).toHaveURL(/\/curso\/[0-9a-f-]{36}\?comparando=/);

    await page.getByRole("link", { name: "Añadir a la comparación" }).click();

    await expect(page).toHaveURL(/\/comparar\?ids=/);
    await expect(page.locator("thead th")).toHaveCount(3);
    expect(await page.locator("thead th a").allTextContents()).toEqual(
      expect.arrayContaining(titulos)
    );
  });

  test("una comparación al máximo no ofrece añadir uno más, lo explica", async ({ page }) => {
    await page.goto("/buscar");
    const casillas = page.locator('input[name="ids"]');
    for (let i = 0; i < 4; i++) await casillas.nth(i).check();

    // El quinto curso de la lista no forma parte de la comparación: sirve
    // para comprobar la ficha de "uno de más" sin depender de ids fijos.
    const quintoId = await casillas.nth(4).getAttribute("value");

    await page.getByRole("button", { name: "Comparar seleccionados" }).click();
    await expect(page).toHaveURL(/\/comparar\?ids=/);

    // Casillas repetidas del mismo nombre van como varios `ids=` en la URL,
    // no como uno solo separado por comas — hay que recogerlos todos.
    const ids = new URL(page.url()).searchParams.getAll("ids").join(",");
    await page.goto(`/curso/${quintoId}?comparando=${ids}`);

    await expect(page.getByRole("link", { name: "Añadir a la comparación" })).toHaveCount(0);
    await expect(page.getByText(/ya tiene 4 cursos/i)).toBeVisible();
  });

  test("los enlaces nuevos son autocontenidos: funcionan abiertos directamente", async ({
    page,
    context,
  }) => {
    await page.goto("/buscar");
    const primerId = await page.locator('input[name="ids"]').first().getAttribute("value");

    const directa = await context.newPage();
    await directa.goto(`/buscar?preseleccionado=${primerId}`);
    await expect(directa.locator(`input[name="ids"][value="${primerId}"]`)).toBeChecked();
    await directa.close();
  });
});
