import { expect, test } from "@playwright/test";

// Un test por criterio de aceptación de HU-028.

test.describe("HU-028 — cuántos resultados hay", () => {
  test("sin filtros se ve cuántos cursos hay", async ({ page }) => {
    await page.goto("/buscar");

    await expect(page.getByText(/cursos encontrados/)).toBeVisible();
  });

  test("con una palabra clave, el número es menor que el del catálogo entero", async ({
    page,
  }) => {
    await page.goto("/buscar");
    const textoTotal = await page.getByText(/cursos encontrados/).textContent();
    const total = Number((textoTotal ?? "").replace(/\D/g, ""));
    expect(total).toBeGreaterThan(0);

    await page.goto("/buscar?keyword=python");
    const textoFiltrado = await page.getByText(/cursos? encontrados?/).textContent();
    const filtrado = Number((textoFiltrado ?? "").replace(/\D/g, ""));

    expect(filtrado).toBeGreaterThan(0);
    expect(filtrado).toBeLessThan(total);
  });

  test("sin resultados se dice que no hay ninguno, no un cero suelto", async ({ page }) => {
    await page.goto("/buscar?keyword=zzz-no-existe-ningun-curso-asi");

    await expect(
      page.getByText("No se ha encontrado ningún curso con esos criterios.")
    ).toBeVisible();
    // Ni "0 cursos encontrados" en ningún sitio de la página.
    await expect(page.getByText(/^0 cursos/)).toHaveCount(0);
  });

  test("en la segunda página el número sigue siendo el total, no el de la página", async ({
    page,
  }) => {
    // Con palabra clave, no sin filtros: otras suites e2e siembran y borran
    // cursos reales en paralelo (HU-029, HU-030), y sin filtro este test
    // compara el tamaño del catálogo entero entre dos cargas de página —
    // exactamente lo que esos cursos de prueba cambian mientras corren. Un
    // curso llamado "Curso HU-030 ..." no coincide con "python", así que el
    // recuento que se compara aquí queda fuera de esa carrera.
    await page.goto("/buscar?keyword=python");
    const enPrimera = await page.getByText(/cursos encontrados/).textContent();

    await page.getByRole("link", { name: "Siguiente" }).click();
    await expect(page).toHaveURL(/pagina=2/);

    const enSegunda = await page.getByText(/cursos encontrados/).textContent();
    expect(enSegunda).toBe(enPrimera);
  });
});
