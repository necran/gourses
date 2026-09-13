import { expect, test, type Page } from "@playwright/test";
import { abrirSesion, borrarUsuario, HAY_CREDENCIALES } from "./support/sesion";

// Un test por criterio de aceptación de HU-045.

const correoUnico = (que: string) =>
  `zzz-hu045-e2e-${que}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

const guardarPrimero = (page: Page) =>
  page.getByRole("button", { name: /^Guardar .* en favoritos$/ }).first();
const quitarPrimero = (page: Page) =>
  page.getByRole("button", { name: /^Quitar .* de favoritos$/ }).first();

// El título del curso de una tarjeta, a partir de su botón de favorito.
const tituloDelPrimero = async (page: Page) => {
  const etiqueta = (await guardarPrimero(page).getAttribute("aria-label")) ?? "";
  return etiqueta.replace(/^Guardar /, "").replace(/ en favoritos$/, "");
};

test.describe("HU-045 — guardar en favoritos desde los resultados", () => {
  test.skip(!HAY_CREDENCIALES, "Requiere las variables de Supabase en .env.local");

  test("con sesión, cada resultado ofrece guardarlo, y lo ya guardado se ve guardado", async ({
    page,
    context,
  }) => {
    const { userId } = await abrirSesion(context, correoUnico("ofrece"));
    try {
      await page.goto("/buscar");

      const botones = page.getByRole("button", { name: /en favoritos$/ });
      expect(await botones.count()).toBeGreaterThan(1);

      const titulo = await tituloDelPrimero(page);
      await guardarPrimero(page).click();

      await expect(
        page.getByRole("button", { name: `Quitar ${titulo} de favoritos` })
      ).toBeVisible();

      // Y sigue guardado al volver a cargar la búsqueda, no solo en pantalla.
      await page.goto("/buscar");
      await expect(
        page.getByRole("button", { name: `Quitar ${titulo} de favoritos` })
      ).toBeVisible();
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("guardar no me saca de la búsqueda: conserva filtros, orden y página", async ({
    page,
    context,
  }) => {
    const { userId } = await abrirSesion(context, correoUnico("conserva"));
    try {
      const busqueda = "/buscar?keyword=python&orden=precio-asc&pagina=2";
      await page.goto(busqueda);
      await expect(page.getByText("Página 2")).toBeVisible();

      await guardarPrimero(page).click();
      await expect(quitarPrimero(page)).toBeVisible();

      const url = new URL(page.url());
      expect([
        url.pathname,
        url.searchParams.get("keyword"),
        url.searchParams.get("orden"),
        url.searchParams.get("pagina"),
      ]).toEqual(["/buscar", "python", "precio-asc", "2"]);
      await expect(page.getByText("Página 2")).toBeVisible();
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("volver a pulsar lo quita", async ({ page, context }) => {
    const { userId } = await abrirSesion(context, correoUnico("quitar"));
    try {
      await page.goto("/buscar");
      const titulo = await tituloDelPrimero(page);

      await guardarPrimero(page).click();
      await expect(
        page.getByRole("button", { name: `Quitar ${titulo} de favoritos` })
      ).toBeVisible();

      await page.getByRole("button", { name: `Quitar ${titulo} de favoritos` }).click();

      await expect(
        page.getByRole("button", { name: `Guardar ${titulo} en favoritos` })
      ).toBeVisible();
      await page.goto("/favoritos");
      await expect(page.getByRole("link", { name: titulo })).toHaveCount(0);
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("lo guardado desde los resultados aparece en /favoritos y en mi cuenta", async ({
    page,
    context,
  }) => {
    const { userId } = await abrirSesion(context, correoUnico("aparece"));
    try {
      await page.goto("/buscar");
      const titulo = await tituloDelPrimero(page);
      await guardarPrimero(page).click();
      await expect(quitarPrimero(page)).toBeVisible();

      await page.goto("/favoritos");
      await expect(page.getByRole("link", { name: titulo })).toBeVisible();

      await page.goto("/mi-cuenta");
      await expect(page.locator("main")).toContainText(/1 curso guardado/i);
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("sin sesión no se ofrece un botón que no podría funcionar", async ({ page }) => {
    await page.goto("/buscar");

    await expect(page.getByRole("button", { name: /en favoritos$/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /de favoritos$/ })).toHaveCount(0);

    // La ficha sigue invitando a entrar, que es el camino de HU-019.
    await page.locator("main li h2 a").first().click();
    await expect(page.getByRole("link", { name: /Entra en tu cuenta/i })).toBeVisible();
  });

  test("guardar desde los resultados no interfiere con comparar ni con la cesta", async ({
    page,
    context,
  }) => {
    const { userId } = await abrirSesion(context, correoUnico("comparar"));
    try {
      await page.goto("/buscar");
      const casillas = page.locator('input[type="checkbox"][name="ids"]');
      await casillas.nth(0).check();
      await casillas.nth(1).check();
      await expect(
        page.getByRole("complementary", { name: "Cursos marcados para comparar" })
      ).toContainText("2 de 4");

      await guardarPrimero(page).click();
      await expect(quitarPrimero(page)).toBeVisible();

      // La cesta vive en el navegador (HU-040) y sobrevive a la recarga que
      // provoca guardar; comparar sigue llevando a la comparación de dos.
      await expect(
        page.getByRole("complementary", { name: "Cursos marcados para comparar" })
      ).toContainText("2 de 4");
      await page.getByRole("button", { name: "Comparar seleccionados" }).click();
      await expect(page).toHaveURL(/\/comparar\?ids=/);
      await expect(page.locator("thead th")).toHaveCount(3);
    } finally {
      await borrarUsuario(userId);
    }
  });

  test.describe("sin JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("guardar y quitar funcionan igual", async ({ page, context }) => {
      const { userId } = await abrirSesion(context, correoUnico("sin-js"));
      try {
        await page.goto("/buscar?keyword=python");
        const titulo = await tituloDelPrimero(page);

        await guardarPrimero(page).click();
        const quitar = page.getByRole("button", { name: `Quitar ${titulo} de favoritos` });
        await expect(quitar).toBeVisible();
        expect(new URL(page.url()).searchParams.get("keyword")).toBe("python");

        await quitar.click();
        await expect(
          page.getByRole("button", { name: `Guardar ${titulo} en favoritos` })
        ).toBeVisible();
      } finally {
        await borrarUsuario(userId);
      }
    });
  });
});
