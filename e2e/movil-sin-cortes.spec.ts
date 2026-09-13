import { expect, test, type Page } from "@playwright/test";
import { abrirSesion, borrarUsuario, HAY_CREDENCIALES } from "./support/sesion";

// Un test por criterio de aceptación de HU-043. Todos con la pantalla a 400 px,
// que es la referencia de móvil estrecho del proyecto.

test.use({ viewport: { width: 400, height: 800 } });

// Lo que se sale de la pantalla y **no** vive dentro de un contenedor con
// desplazamiento propio: la tabla de /comparar sí se sale de la pantalla a
// propósito, y se lee desplazándola dentro de su caja (HU-017).
async function loQueSeSale(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const ancho = window.innerWidth;
    const enContenedorConScroll = (elemento: Element) => {
      for (let padre = elemento.parentElement; padre; padre = padre.parentElement) {
        const overflowX = getComputedStyle(padre).overflowX;
        if (overflowX === "auto" || overflowX === "scroll") return true;
      }
      return false;
    };
    return [...document.querySelectorAll("body *")]
      .filter((e) => e.getBoundingClientRect().right > ancho + 1 && !enContenedorConScroll(e))
      .map((e) => `${e.tagName.toLowerCase()}.${e.className.toString().split(" ")[0]}`);
  });
}

async function noSeSaleNada(page: Page) {
  expect(await loQueSeSale(page)).toEqual([]);
  const desplazamiento = await page.evaluate(() => ({
    documento: document.documentElement.scrollWidth,
    ventana: window.innerWidth,
  }));
  expect(desplazamiento.documento).toBeLessThanOrEqual(desplazamiento.ventana);
}

async function idDelPrimerCurso(page: Page): Promise<string> {
  await page.goto("/buscar");
  const href = (await page.locator("main li h2 a").first().getAttribute("href"))!;
  return href.split("/").pop()!;
}

test.describe("HU-043 — el móvil no corta el contenido", () => {
  test("el buscador cabe a lo ancho: formulario y tarjetas", async ({ page }) => {
    await page.goto("/buscar?keyword=python");
    await expect(page.locator("main li").first()).toBeVisible();

    await noSeSaleNada(page);
  });

  test("en la ficha, la imagen y el título se apilan en vez de cortarse", async ({ page }) => {
    await page.goto(`/curso/${await idDelPrimerCurso(page)}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await noSeSaleNada(page);

    // Apilados: la imagen ocupa el ancho y el título queda debajo, no al lado.
    const imagen = page.locator("main img").first();
    if (await imagen.isVisible()) {
      const caja = (await imagen.boundingBox())!;
      const titulo = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
      expect(titulo.y).toBeGreaterThan(caja.y + caja.height - 1);
    }
  });

  test("la comparación no desborda la página, y su tabla sigue desplazándose sola", async ({
    page,
  }) => {
    await page.goto("/buscar");
    const ids = await page
      .locator("main li h2 a")
      .evaluateAll((enlaces) =>
        enlaces.slice(0, 3).map((a) => a.getAttribute("href")!.split("/").pop()!)
      );
    await page.goto(`/comparar?ids=${ids.join(",")}`);
    await expect(page.locator("table")).toBeVisible();

    await noSeSaleNada(page);

    // La tabla sigue siendo más ancha que su caja: es lo que permite leerla
    // desplazándola, y no debe «arreglarse» estrujándola.
    const contenedor = page.locator("table").locator("xpath=..");
    const desborda = await contenedor.evaluate((e) => e.scrollWidth > e.clientWidth);
    expect(desborda).toBe(true);
  });

  test("la portada y una página legal siguen sin cortarse", async ({ page }) => {
    for (const ruta of ["/", "/privacidad"]) {
      await page.goto(ruta);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await noSeSaleNada(page);
    }
  });

  test("con la cesta llena, la barra tampoco desborda", async ({ page }) => {
    await page.goto("/buscar");
    const casillas = page.locator('input[type="checkbox"][name="ids"]');
    for (let i = 0; i < 4; i++) await casillas.nth(i).check();
    await expect(
      page.getByRole("complementary", { name: "Cursos marcados para comparar" })
    ).toContainText("4 de 4");

    await noSeSaleNada(page);
  });

  test("favoritos y mi cuenta tampoco se cortan", async ({ page, context }) => {
    test.skip(!HAY_CREDENCIALES, "Requiere las variables de Supabase en .env.local");
    const correo = `zzz-hu043-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    const { userId } = await abrirSesion(context, correo);
    try {
      await page.goto(`/curso/${await idDelPrimerCurso(page)}`);
      await page.getByRole("button", { name: /Guardar en favoritos/i }).click();
      await expect(page.getByRole("button", { name: /Quitar de favoritos/i })).toBeVisible();

      for (const ruta of ["/favoritos", "/mi-cuenta"]) {
        await page.goto(ruta);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await noSeSaleNada(page);
      }
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("en escritorio no cambia nada: el contenido sigue centrado y ancho", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/buscar?keyword=python");
    await expect(page.locator("main li").first()).toBeVisible();

    await noSeSaleNada(page);
    const main = (await page.locator("main").boundingBox())!;
    expect(main.width).toBeGreaterThan(1000);
  });
});
