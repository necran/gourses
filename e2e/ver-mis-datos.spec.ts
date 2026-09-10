import { expect, test, type Page } from "@playwright/test";
import { abrirSesion, borrarUsuario, HAY_CREDENCIALES } from "./support/sesion";

// Un test por criterio de aceptación de HU-036 (derecho de acceso, RGPD art. 15).

function correoUnico(que: string): string {
  return `zzz-hu036-e2e-${que}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function guardarPrimerCurso(page: Page): Promise<void> {
  await page.goto("/buscar");
  const primero = page.locator("main li h2 a").first();
  await primero.click();
  await expect(page).toHaveURL(/\/curso\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: /Guardar en favoritos/i }).click();
  await expect(page.getByRole("button", { name: /Quitar de favoritos/i })).toBeVisible();
}

// La sección «Qué guardamos sobre ti» de /mi-cuenta.
function resumen(page: Page) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Qué guardamos sobre ti" }) });
}

test.describe("HU-036 — ver mis datos en la cuenta", () => {
  test.skip(!HAY_CREDENCIALES, "Requiere las variables de Supabase en .env.local");

  test("la cuenta muestra en lenguaje llano qué datos se guardan", async ({ page, context }) => {
    const correo = correoUnico("resumen");
    const { userId } = await abrirSesion(context, correo);
    try {
      await guardarPrimerCurso(page);
      await page.goto("/mi-cuenta");

      const seccion = resumen(page);
      await expect(seccion).toBeVisible();
      await expect(seccion).toContainText(correo);
      await expect(seccion).toContainText("Cuenta creada el");
      await expect(seccion).toContainText("Último acceso");
      // Una fecha en formato humano, no un ISO crudo.
      await expect(seccion).toContainText(/\d{1,2} de [a-zé]+ de \d{4}/i);
      await expect(seccion).not.toContainText(/\d{4}-\d{2}-\d{2}T/);
      await expect(seccion).toContainText(/Cursos en favoritos\s*1/i);
      await expect(seccion).toContainText(/Avisos de bajada de precio\s*(Activados|Desactivados)/i);
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("el resumen dice para qué y durante cuánto tiempo, en línea con /privacidad", async ({
    page,
    context,
  }) => {
    const { userId } = await abrirSesion(context, correoUnico("finalidad"));
    try {
      await page.goto("/mi-cuenta");
      await expect(resumen(page)).toContainText(/mientras tengas la cuenta/i);
      await expect(resumen(page)).toContainText(/identificarte/i);
      await expect(resumen(page)).toContainText(/6\.1\.b/);

      // La misma promesa de plazo tiene que estar en la política: si una cambia
      // y la otra no, una de las dos miente.
      await page.goto("/privacidad");
      await expect(page.locator("main")).toContainText(/mientras tengas la cuenta/i);
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("desde el resumen se llega a descargar y a borrar", async ({ page, context }) => {
    const { userId } = await abrirSesion(context, correoUnico("enlaces"));
    try {
      await page.goto("/mi-cuenta");
      const seccion = resumen(page);

      await expect(seccion.getByRole("link", { name: /descargar/i })).toHaveAttribute(
        "href",
        "#mis-datos"
      );
      await expect(seccion.getByRole("link", { name: /borrar la cuenta/i })).toHaveAttribute(
        "href",
        "#borrar-cuenta"
      );

      // Y los anclas existen: la descarga de HU-024 y el borrado de HU-020.
      await expect(page.locator("#mis-datos")).toBeVisible();
      await expect(page.locator("#borrar-cuenta")).toBeVisible();
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("sin sesión, /mi-cuenta lleva a la página de acceso sin filtrar nada", async ({ page }) => {
    await page.goto("/mi-cuenta");
    await expect(page).toHaveURL(/\/acceder$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Entrar en tu cuenta");
  });

  test("el resumen de una cuenta no muestra datos de otra", async ({ page, context, browser }) => {
    const correoA = correoUnico("aisla-a");
    const correoB = correoUnico("aisla-b");
    const { userId: idA } = await abrirSesion(context, correoA);

    // Segundo contexto: la cuenta B, con su propio favorito.
    const contextoB = await browser.newContext();
    const { userId: idB } = await abrirSesion(contextoB, correoB);
    const paginaB = await contextoB.newPage();
    try {
      await guardarPrimerCurso(paginaB);

      await page.goto("/mi-cuenta");
      const seccion = resumen(page);
      await expect(seccion).toContainText(correoA);
      await expect(seccion).not.toContainText(correoB);
      // B tiene 1 favorito; A no tiene ninguno.
      await expect(seccion).toContainText(/Cursos en favoritos\s*0/i);
    } finally {
      await paginaB.close();
      await contextoB.close();
      await borrarUsuario(idA);
      await borrarUsuario(idB);
    }
  });

  test("la política de privacidad dice que el acceso se ejerce desde la cuenta", async ({
    page,
  }) => {
    await page.goto("/privacidad");
    const derechos = page.locator("main");

    // El acceso ya no está en la lista de «escribiendo a un buzón».
    await expect(derechos).toContainText(/ver qué datos tenemos sobre ti/i);
    await expect(derechos).toContainText(/rectificación, oposición y limitación/i);
    await expect(derechos).not.toContainText(/acceso, rectificación, oposición y limitación/i);
  });
});
