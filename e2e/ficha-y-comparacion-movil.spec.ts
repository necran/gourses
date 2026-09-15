import { expect, test, type Page } from "@playwright/test";

// Un test por criterio de aceptación de HU-055. Con la pantalla a 400 × 800, la
// referencia de móvil estrecho del proyecto (HU-043), salvo el de escritorio.

test.use({ viewport: { width: 400, height: 800 } });

// Cursos del catálogo real (con imagen): los sembrados por otros tests no la
// tienen y pueden desaparecer a mitad de la prueba.
async function idsReales(page: Page, cuantos: number): Promise<string[]> {
  await page.goto("/buscar");
  return page
    .locator("main li:has(img) h2 a")
    .evaluateAll(
      (enlaces, n) => enlaces.slice(0, n).map((a) => a.getAttribute("href")!.split("/").pop()!),
      cuantos
    );
}

async function controlesPequenosYLetra(page: Page) {
  return page.evaluate(() => {
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return r.width > 1 && r.height > 1 && s.visibility !== "hidden" && s.opacity !== "0";
    };
    const pequenos = [...document.querySelectorAll("main a, main button, main input, main select")]
      .filter(visible)
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width < 24 || r.height < 24;
      })
      .map((e) => `${e.tagName.toLowerCase()} «${(e.textContent ?? "").trim().slice(0, 30)}» ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}`);
    const letra = [...document.querySelectorAll("main *")]
      .filter((e) => visible(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()))
      .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 12)
      .map((e) => `${e.tagName.toLowerCase()} ${getComputedStyle(e).fontSize}`);
    return { pequenos, letra };
  });
}

test.describe("HU-055 — ficha y comparación en el móvil", () => {
  test("en la ficha, el precio y «Ver curso» están en la primera pantalla, antes de guardar y comparar", async ({
    page,
  }) => {
    const [id] = await idsReales(page, 1);
    await page.goto(`/curso/${id}`);

    const verCurso = page.getByRole("link", { name: /^Ver curso en/ });
    await expect(verCurso).toBeInViewport({ ratio: 1 });

    const compra = page.locator("main section").first();
    await expect(compra.locator("p").first()).toBeInViewport();

    // Antes que las acciones secundarias, en el orden del documento.
    const orden = await compra.evaluate((seccion) => {
      const nodos = [...seccion.querySelectorAll("a, button")].map((e) => (e.textContent ?? "").trim());
      return {
        verCurso: nodos.findIndex((t) => t.startsWith("Ver curso en")),
        comparar: nodos.findIndex((t) => /comparaci/i.test(t)),
      };
    });
    expect(orden.verCurso).toBeGreaterThanOrEqual(0);
    expect(orden.verCurso).toBeLessThan(orden.comparar);
  });

  test("en la ficha, los controles miden al menos 24 × 24 px y ningún texto baja de 12 px", async ({
    page,
  }) => {
    const [id] = await idsReales(page, 1);
    await page.goto(`/curso/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const { pequenos, letra } = await controlesPequenosYLetra(page);
    expect(pequenos).toEqual([]);
    expect(letra).toEqual([]);
  });

  test("con dos cursos, la comparación los muestra enteros sin desplazar, y cada dato con su etiqueta", async ({
    page,
  }) => {
    const ids = await idsReales(page, 2);
    await page.goto(`/comparar?ids=${ids.join(",")}`);
    await expect(page.locator("table")).toBeVisible();

    const contenedor = page.locator("table").locator("xpath=..");
    expect(await contenedor.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
    for (const titulo of await page.locator("thead th a").all()) {
      await expect(titulo).toBeInViewport({ ratio: 1 });
    }

    const etiquetaPrecio = await page
      .locator("td[data-etiqueta='Precio']")
      .first()
      .evaluate((td) => getComputedStyle(td, "::before").content);
    expect(etiquetaPrecio).toContain("Precio");
  });

  test("para el lector de pantalla, cada fila de la comparación conserva su encabezado", async ({
    page,
  }) => {
    const ids = await idsReales(page, 2);
    await page.goto(`/comparar?ids=${ids.join(",")}`);

    for (const nombre of ["Plataforma", "Precio", "Idioma", "Ir al curso"]) {
      await expect(page.getByRole("rowheader", { name: nombre })).toHaveCount(1);
    }
    const celda = page.getByRole("cell").filter({ hasText: /Udemy|Coursera/ }).first();
    await expect(celda).toBeVisible();
  });

  test("la comparación nombra el idioma, no su código", async ({ page }) => {
    const ids = await idsReales(page, 2);
    await page.goto(`/comparar?ids=${ids.join(",")}`);

    const idioma = page.locator("td[data-etiqueta='Idioma']");
    const textos = (await idioma.allTextContents()).map((t) => t.trim());
    expect(textos.length).toBe(2);
    for (const t of textos) expect(t).not.toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
  });

  test("en escritorio, la tabla conserva su columna de etiquetas", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const ids = await idsReales(page, 2);
    await page.goto(`/comparar?ids=${ids.join(",")}`);

    await expect(page.getByRole("rowheader", { name: "Plataforma" })).toBeVisible();
    await expect(page.getByRole("rowheader", { name: "Precio" })).toBeVisible();
  });
});
