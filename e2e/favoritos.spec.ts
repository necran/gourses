import { expect, test, type Page } from "@playwright/test";
import { abrirSesion, borrarUsuario, HAY_CREDENCIALES } from "./support/sesion";

// Un test por criterio de aceptación de HU-019.
//
// Los que necesitan sesión la abren con la API de administración (ver
// support/sesion.ts): el camino del correo real está limitado a 2 mensajes por
// hora en todo el proyecto y no sirve para una suite.

// Cada test usa su propia cuenta: así pueden correr en paralelo sin pisarse los
// favoritos unos a otros.
function correoUnico(que: string): string {
  return `zzz-hu019-e2e-${que}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

// Entra en la ficha del primer curso del catálogo y devuelve su título.
async function irAlPrimerCurso(page: Page): Promise<string> {
  await page.goto("/buscar");
  const primero = page.locator("main li h2 a").first();
  const titulo = (await primero.textContent()) ?? "";
  await primero.click();
  await expect(page).toHaveURL(/\/curso\/[0-9a-f-]{36}$/);
  return titulo.trim();
}

const guardar = /Guardar en favoritos/i;
const quitar = /Quitar de favoritos/i;

test.describe("HU-019 — favoritos", () => {
  test.skip(!HAY_CREDENCIALES, "Requiere las variables de Supabase en .env.local");

  test("con sesión, guardar un curso cambia el botón a quitarlo", async ({ page, context }) => {
    const { userId } = await abrirSesion(context, correoUnico("guardar"));
    try {
      await irAlPrimerCurso(page);

      await page.getByRole("button", { name: guardar }).click();

      await expect(page.getByRole("button", { name: quitar })).toBeVisible();
      await expect(page.getByRole("button", { name: guardar })).toHaveCount(0);
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("quitar un curso guardado vuelve a ofrecer guardarlo", async ({ page, context }) => {
    const { userId } = await abrirSesion(context, correoUnico("quitar"));
    try {
      await irAlPrimerCurso(page);
      await page.getByRole("button", { name: guardar }).click();
      await expect(page.getByRole("button", { name: quitar })).toBeVisible();

      await page.getByRole("button", { name: quitar }).click();

      await expect(page.getByRole("button", { name: guardar })).toBeVisible();
      await expect(page.getByRole("button", { name: quitar })).toHaveCount(0);
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("los cursos guardados aparecen en /favoritos y enlazan a su ficha", async ({
    page,
    context,
  }) => {
    const { userId } = await abrirSesion(context, correoUnico("lista"));
    try {
      const titulo = await irAlPrimerCurso(page);
      const urlFicha = page.url();
      await page.getByRole("button", { name: guardar }).click();
      await expect(page.getByRole("button", { name: quitar })).toBeVisible();

      await page.goto("/favoritos");

      const enlace = page.getByRole("link", { name: titulo });
      await expect(enlace).toBeVisible();

      await enlace.click();
      // `toHaveURL` reintenta; `page.url()` a secas leería antes de navegar.
      await expect(page).toHaveURL(urlFicha);
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("sin ningún favorito se explica cómo guardar el primero", async ({ page, context }) => {
    const { userId } = await abrirSesion(context, correoUnico("vacio"));
    try {
      await page.goto("/favoritos");

      // Un aviso, no un error: se dice qué hacer y se ofrece el camino.
      const aviso = page.getByRole("status");
      await expect(aviso).toContainText(/todavía no has guardado ningún curso/i);
      await expect(page.getByRole("link", { name: /buscar cursos/i }).first()).toBeVisible();
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("sin sesión, /favoritos lleva a la página de acceso", async ({ page }) => {
    await page.goto("/favoritos");

    await expect(page).toHaveURL(/\/acceder$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Entrar en tu cuenta");
  });

  test("sin sesión, la ficha invita a entrar en vez de mostrar un botón que fallaría", async ({
    page,
  }) => {
    await irAlPrimerCurso(page);

    await expect(page.getByRole("button", { name: guardar })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /entra en tu cuenta/i })).toBeVisible();
  });

  test("lo guardado sigue ahí tras cerrar sesión y volver a entrar", async ({ page, context }) => {
    const correo = correoUnico("persiste");
    const { userId } = await abrirSesion(context, correo);
    try {
      const titulo = await irAlPrimerCurso(page);
      await page.getByRole("button", { name: guardar }).click();
      await expect(page.getByRole("button", { name: quitar })).toBeVisible();

      // Cerrar sesión de verdad, por donde lo haría cualquiera.
      await page.goto("/mi-cuenta");
      await page.getByRole("button", { name: /cerrar sesión/i }).click();
      await expect(page).toHaveURL(/\/$/);

      // Y comprobar que de verdad se salió, no que lo parezca.
      await page.goto("/favoritos");
      await expect(page).toHaveURL(/\/acceder$/);

      await abrirSesion(context, correo);
      await page.goto("/favoritos");

      await expect(page.getByRole("link", { name: titulo })).toBeVisible();
    } finally {
      await borrarUsuario(userId);
    }
  });
});
