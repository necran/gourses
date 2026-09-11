import { expect, test, type Page } from "@playwright/test";

// Un test por criterio de aceptación de HU-040. Cada test arranca con un
// contexto de navegador nuevo, así que la cesta (localStorage) empieza vacía.

const casillas = (page: Page) => page.locator('input[type="checkbox"][name="ids"]');
const casillaDe = (page: Page, id: string) =>
  page.locator(`input[type="checkbox"][name="ids"][value="${id}"]`);
const barra = (page: Page) =>
  page.getByRole("complementary", { name: "Cursos marcados para comparar" });
const titulo = async (page: Page, i: number) =>
  ((await page.locator("main li h2 a").nth(i).textContent()) ?? "").trim();

async function marcar(page: Page, i: number): Promise<string> {
  const casilla = casillas(page).nth(i);
  const id = (await casilla.getAttribute("value"))!;
  await casilla.check();
  return id;
}

test.describe("HU-040 — cesta de comparación", () => {
  test("marcar, entrar en la ficha de otro y volver con «atrás» conserva lo marcado", async ({
    page,
  }) => {
    await page.goto("/buscar");
    const id = await marcar(page, 0);
    await expect(barra(page)).toContainText("1 de 4");

    await page.locator("main li h2 a").nth(1).click();
    await expect(page).toHaveURL(/\/curso\//);
    await page.goBack();

    await expect(page).toHaveURL(/\/buscar$/);
    await expect(casillaDe(page, id)).toBeChecked();
  });

  test("marcar en dos páginas distintas permite compararlos juntos", async ({ page }) => {
    await page.goto("/buscar");
    const tituloPagina1 = await titulo(page, 0);
    await marcar(page, 0);
    await expect(barra(page)).toContainText("1 de 4");

    await page.getByRole("link", { name: "Siguiente" }).click();
    await expect(page.getByText("Página 2")).toBeVisible();
    const tituloPagina2 = await titulo(page, 0);
    await marcar(page, 0);
    await expect(barra(page)).toContainText("2 de 4");

    await page.getByRole("button", { name: "Comparar seleccionados" }).click();
    await expect(page).toHaveURL(/\/comparar\?ids=/);
    await expect(page.locator("thead th")).toHaveCount(3);
    expect((await page.locator("thead th a").allTextContents()).map((t) => t.trim())).toEqual(
      expect.arrayContaining([tituloPagina1, tituloPagina2])
    );
  });

  test("cambiar de búsqueda conserva lo marcado, y sale marcado si vuelve a aparecer", async ({
    page,
  }) => {
    await page.goto("/buscar");
    const nombre = await titulo(page, 0);
    const id = await marcar(page, 0);
    await expect(barra(page)).toContainText("1 de 4");

    // Buscarlo por su propio título garantiza que aparece en los resultados
    // nuevos, sin depender de qué otros cursos haya en el catálogo.
    await page.getByLabel("Palabra clave").fill(nombre);
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect(page).toHaveURL(/keyword=/);

    await expect(casillaDe(page, id)).toBeChecked();
    await expect(barra(page)).toContainText("1 de 4");
  });

  test("la barra se ve en cualquier página, con cuántos llevo, sus títulos y «Comparar»", async ({
    page,
  }) => {
    await page.goto("/buscar");
    const nombres = [await titulo(page, 0), await titulo(page, 1)];
    await marcar(page, 0);
    await marcar(page, 1);
    await expect(barra(page)).toContainText("2 de 4");

    for (const ruta of ["/", "/privacidad"]) {
      await page.goto(ruta);
      // «Se ve» es en pantalla, no en algún punto del documento: las dos
      // páginas son más largas que la ventana y se miran desde arriba.
      await expect(barra(page)).toBeInViewport();
      await expect(barra(page)).toContainText("2 de 4");
      for (const nombre of nombres) await expect(barra(page)).toContainText(nombre);
      await expect(barra(page).getByRole("link", { name: "Comparar", exact: true })).toBeVisible();
    }

    await barra(page).getByRole("link", { name: "Comparar", exact: true }).click();
    await expect(page).toHaveURL(/\/comparar\?ids=/);
    await expect(page.locator("thead th")).toHaveCount(3);
  });

  test("con un solo curso, «Comparar» no está activo y se explica por qué", async ({ page }) => {
    await page.goto("/buscar");
    await marcar(page, 0);

    const comparar = barra(page).getByRole("button", { name: "Comparar", exact: true });
    await expect(comparar).toBeDisabled();
    await expect(barra(page)).toContainText(/al menos otro curso/i);
  });

  test("la × de la barra quita el curso y desmarca su casilla", async ({ page }) => {
    await page.goto("/buscar");
    const nombre = await titulo(page, 0);
    const id = await marcar(page, 0);
    await marcar(page, 1);
    await expect(barra(page)).toContainText("2 de 4");

    await barra(page).getByRole("button", { name: `Quitar ${nombre} de la comparación` }).click();

    await expect(barra(page)).toContainText("1 de 4");
    await expect(barra(page)).not.toContainText(nombre);
    await expect(casillaDe(page, id)).not.toBeChecked();
  });

  test("«Vaciar» deja la cesta vacía, sin barra ni casillas marcadas", async ({ page }) => {
    await page.goto("/buscar");
    await marcar(page, 0);
    await marcar(page, 1);
    await expect(barra(page)).toContainText("2 de 4");

    await barra(page).getByRole("button", { name: "Vaciar" }).click();

    await expect(barra(page)).toHaveCount(0);
    await expect(page.locator('input[type="checkbox"][name="ids"]:checked')).toHaveCount(0);
  });

  test("con el máximo alcanzado, las demás casillas se deshabilitan y se explica", async ({
    page,
  }) => {
    await page.goto("/buscar");
    for (let i = 0; i < 4; i++) await marcar(page, i);
    await expect(barra(page)).toContainText("4 de 4");

    await expect(casillas(page).nth(4)).toBeDisabled();
    await expect(casillas(page).nth(0)).toBeEnabled();
    await expect(barra(page)).toContainText(/máximo de 4/i);

    // También en otra página: allí ninguna de las cuatro está.
    await page.getByRole("link", { name: "Siguiente" }).click();
    await expect(page.getByText("Página 2")).toBeVisible();
    await expect(casillas(page).first()).toBeDisabled();
  });

  test("la cesta sobrevive a recargar y a cerrar y abrir otra pestaña", async ({
    page,
    context,
  }) => {
    await page.goto("/buscar");
    const id = await marcar(page, 0);
    await expect(barra(page)).toContainText("1 de 4");

    await page.reload();
    await expect(casillaDe(page, id)).toBeChecked();
    await expect(barra(page)).toContainText("1 de 4");
    await page.close();

    const nueva = await context.newPage();
    await nueva.goto("/buscar");
    await expect(casillaDe(nueva, id)).toBeChecked();
    await expect(barra(nueva)).toContainText("1 de 4");
  });

  test("lo que marco en una pestaña aparece en la otra sin recargar", async ({ context }) => {
    const una = await context.newPage();
    const otra = await context.newPage();
    await una.goto("/buscar");
    await otra.goto("/buscar");
    await expect(otra.getByText("Página 1")).toBeVisible();

    const id = await marcar(una, 0);

    await expect(barra(otra)).toContainText("1 de 4");
    await expect(casillaDe(otra, id)).toBeChecked();
  });

  test("con el almacenamiento bloqueado la cesta funciona en la página, sin errores", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new DOMException("Almacenamiento bloqueado", "SecurityError");
        },
      });
    });
    const errores: Error[] = [];
    page.on("pageerror", (error) => errores.push(error));

    await page.goto("/buscar");
    await marcar(page, 0);
    await marcar(page, 1);
    await expect(barra(page)).toContainText("2 de 4");

    await page.getByRole("button", { name: "Comparar seleccionados" }).click();
    await expect(page).toHaveURL(/\/comparar\?ids=/);
    await expect(page.locator("thead th")).toHaveCount(3);
    expect(errores).toEqual([]);
  });

  test("llegar con ?preseleccionado= añade ese curso sin quitar lo que había", async ({ page }) => {
    await page.goto("/buscar");
    const primero = await marcar(page, 0);
    const segundo = (await casillas(page).nth(1).getAttribute("value"))!;
    await expect(barra(page)).toContainText("1 de 4");

    await page.goto(`/buscar?preseleccionado=${segundo}`);

    await expect(barra(page)).toContainText("2 de 4");
    await expect(casillaDe(page, primero)).toBeChecked();
    await expect(casillaDe(page, segundo)).toBeChecked();
  });

  test("la política de privacidad explica qué se guarda en el navegador y cómo borrarlo", async ({
    page,
  }) => {
    await page.goto("/privacidad");
    const main = page.locator("main");

    await expect(main).toContainText(/cursos marcados para comparar/i);
    await expect(main).toContainText(/almacenamiento local/i);
    await expect(main).toContainText(/no son datos personales/i);
    await expect(main).toContainText(/«Vaciar»/);
  });

  test.describe("sin JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("marcar en una página y comparar sigue funcionando como antes", async ({ page }) => {
      await page.goto("/buscar");
      await casillas(page).nth(0).check();
      await casillas(page).nth(1).check();
      await page.getByRole("button", { name: "Comparar seleccionados" }).click();

      await expect(page).toHaveURL(/\/comparar\?ids=/);
      await expect(page.locator("thead th")).toHaveCount(3);
    });
  });
});
