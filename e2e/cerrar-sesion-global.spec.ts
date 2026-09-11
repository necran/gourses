import { expect, test } from "@playwright/test";
import { abrirSesion, borrarUsuario, HAY_CREDENCIALES } from "./support/sesion";

// Un test por criterio de aceptación de HU-038, salvo el de «otro navegador deja
// de estar identificado al no poder renovar»: eso solo se dispara al expirar el
// token de acceso ya emitido (minutos), así que probarlo de verdad y rápido es
// cosa de un test de integración contra Supabase real
// (tests/integration/cerrar-sesion-global.test.ts), no de un navegador que
// tendría que esperar esa expiración para ver algo distinto.

function correoUnico(que: string): string {
  return `zzz-hu038-e2e-${que}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

test.describe("HU-038 — cerrar sesión en todos los dispositivos", () => {
  test.skip(!HAY_CREDENCIALES, "Requiere las variables de Supabase en .env.local");

  test("junto a «Cerrar sesión» hay una opción para todos los dispositivos, con su explicación", async ({
    page,
    context,
  }) => {
    const { userId } = await abrirSesion(context, correoUnico("visible"));
    try {
      await page.goto("/mi-cuenta");

      await expect(page.getByRole("button", { name: "Cerrar sesión", exact: true })).toBeVisible();
      const global = page.getByRole("button", { name: /cerrar sesión en todos los dispositivos/i });
      await expect(global).toBeVisible();

      // La frase que distingue las dos, no solo el botón.
      await expect(page.locator("main")).toContainText(/solo afecta a este navegador/i);
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("al pulsarlo, cierra la sesión de este navegador y lleva fuera de la cuenta", async ({
    page,
    context,
  }) => {
    const { userId } = await abrirSesion(context, correoUnico("local"));
    try {
      await page.goto("/mi-cuenta");
      await page.getByRole("button", { name: /cerrar sesión en todos los dispositivos/i }).click();

      // Mismo destino que el cierre normal.
      await expect(page).toHaveURL(/\/$/);

      // Y de verdad se salió, no que lo parezca.
      await page.goto("/mi-cuenta");
      await expect(page).toHaveURL(/\/acceder$/);
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("tras cerrar en todos los dispositivos, se puede volver a entrar con normalidad", async ({
    page,
    context,
  }) => {
    const correo = correoUnico("reentrar");
    const { userId } = await abrirSesion(context, correo);
    try {
      await page.goto("/mi-cuenta");
      await page.getByRole("button", { name: /cerrar sesión en todos los dispositivos/i }).click();
      await expect(page).toHaveURL(/\/$/);

      // Reabrir sesión por el mismo camino que el ayudante usa para simular el
      // enlace del correo, y comprobar que entra sin ninguna fricción extra.
      await abrirSesion(context, correo);
      await page.goto("/mi-cuenta");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mi cuenta");
      await expect(page.locator("main")).toContainText(correo);
    } finally {
      await borrarUsuario(userId);
    }
  });

  test("sin sesión, la página no ofrece cerrarla y lleva a acceder", async ({ page }) => {
    await page.goto("/mi-cuenta");
    await expect(page).toHaveURL(/\/acceder$/);
    await expect(
      page.getByRole("button", { name: /cerrar sesión en todos los dispositivos/i })
    ).toHaveCount(0);
  });
});
