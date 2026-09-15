import { expect, test, type Page } from "@playwright/test";

// Un test por criterio de aceptación de HU-054. Con la pantalla a 400 × 800,
// la referencia de móvil estrecho del proyecto (HU-043), salvo el de escritorio.

test.use({ viewport: { width: 400, height: 800 } });

const botonFiltros = (page: Page) => page.getByText("Filtros y orden", { exact: false });

test.describe("HU-054 — el buscador en el móvil", () => {
  test("sin filtros, el primer resultado se ve en la primera pantalla y los filtros están plegados", async ({
    page,
  }) => {
    await page.goto("/buscar");

    await expect(page.getByLabel("Palabra clave")).toBeVisible();
    await expect(botonFiltros(page)).toBeVisible();
    await expect(page.getByLabel("Precio máximo")).toBeHidden();

    const primero = page.locator("main li").first();
    await expect(primero).toBeInViewport();

    await botonFiltros(page).click();
    await expect(page.getByLabel("Precio máximo")).toBeVisible();
    await expect(page.getByLabel("Ordenar por")).toBeVisible();
  });

  test("con filtros aplicados, se ven desplegados con sus valores y el botón dice cuántos hay", async ({
    page,
  }) => {
    await page.goto("/buscar?maxPrice=20&language=es");

    await expect(page.getByLabel("Precio máximo")).toBeVisible();
    await expect(page.getByLabel("Precio máximo")).toHaveValue("20");
    await expect(page.getByLabel("Idioma")).toHaveValue("es");
    await expect(page.locator("label[for='ver-filtros']")).toContainText("2");
  });

  test("el idioma se elige por su nombre, y las tarjetas nombran idioma y plataforma", async ({
    page,
  }) => {
    await page.goto("/buscar");
    await botonFiltros(page).click();

    await page.getByLabel("Idioma").selectOption({ label: "Español" });
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page).toHaveURL(/language=es(&|$)/);
    const meta = page.locator("main li p").first();
    await expect(meta).toContainText("Español");
    await expect(meta).toContainText(/Udemy|Coursera/);
    await expect(meta).not.toContainText(/·\s*es\b/);

    // Un idioma que no está en la lista, llegado por la dirección, no se pierde.
    await page.goto("/buscar?language=ca");
    await expect(page.getByLabel("Idioma")).toHaveValue("ca");
    await expect(page.getByLabel("Idioma").locator("option:checked")).toHaveText("Catalán");
  });

  test("los controles miden al menos 24 × 24 px y ningún texto baja de 12 px", async ({
    page,
  }) => {
    await page.goto("/buscar");
    await botonFiltros(page).click();
    await expect(page.getByLabel("Precio máximo")).toBeVisible();

    const medidas = await page.evaluate(() => {
      const visible = (e: Element) => {
        const r = e.getBoundingClientRect();
        const estilo = getComputedStyle(e);
        return r.width > 1 && r.height > 1 && estilo.visibility !== "hidden" && estilo.opacity !== "0";
      };
      const pequenos = [...document.querySelectorAll("main button, main input, main select, main label[for='ver-filtros'], main nav a")]
        .filter(visible)
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width < 24 || r.height < 24;
        })
        .map((e) => `${e.tagName.toLowerCase()} ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}`);

      const letraPequena = [...document.querySelectorAll("main *")]
        .filter((e) => visible(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()))
        .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 12)
        .map((e) => `${e.tagName.toLowerCase()} ${getComputedStyle(e).fontSize}`);

      return { pequenos, letraPequena };
    });

    expect(medidas.pequenos).toEqual([]);
    expect(medidas.letraPequena).toEqual([]);
  });

  test.describe("sin JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("«Filtros y orden» despliega los filtros igual", async ({ page }) => {
      await page.goto("/buscar");
      await expect(page.getByLabel("Precio máximo")).toBeHidden();

      await botonFiltros(page).click();
      await expect(page.getByLabel("Precio máximo")).toBeVisible();
    });
  });

  test("en escritorio los filtros se ven todos, sin botón para desplegarlos", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/buscar");

    await expect(botonFiltros(page)).toBeHidden();
    for (const campo of ["Palabra clave", "Precio máximo", "Valoración mínima", "Duración máxima", "Idioma", "Categoría", "Ordenar por"]) {
      await expect(page.getByLabel(campo)).toBeVisible();
    }
    // Siguen en una sola fila, como antes: el primero y el último a la misma altura.
    const clave = (await page.getByLabel("Palabra clave").boundingBox())!;
    const precio = (await page.getByLabel("Precio máximo").boundingBox())!;
    expect(Math.abs(clave.y - precio.y)).toBeLessThan(4);
  });
});
