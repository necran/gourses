import { expect, test } from "@playwright/test";

test.describe("HU-018 — cuentas", () => {
  test("una página privada lleva a acceder cuando no hay sesión", async ({ page }) => {
    await page.goto("/mi-cuenta");

    await expect(page).toHaveURL(/\/acceder$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Entrar en tu cuenta");
  });

  test("el pie ofrece acceder desde cualquier página", async ({ page }) => {
    for (const ruta of ["/", "/buscar"]) {
      await page.goto(ruta);
      const pie = page.getByRole("navigation", { name: "Enlaces legales" });
      await expect(pie.getByRole("link", { name: "Acceder" })).toBeVisible();
    }
  });

  test("un correo con formato inválido no envía nada y avisa", async ({ page }) => {
    await page.goto("/acceder");

    // El navegador bloquearía el envío con su propia validación, y entonces
    // nunca se probaría la del servidor, que es la que de verdad protege.
    await page.locator("form").evaluate((f: HTMLFormElement) => {
      f.noValidate = true;
    });
    await page.locator("#email").fill("esto-no-es-un-correo");
    await page.getByRole("button", { name: /Enviarme el enlace/i }).click();

    const error = page.locator("#error-email");
    await expect(error).toContainText(/dirección de correo válida/i);
    // Debe anunciarse a lectores de pantalla, no solo verse.
    await expect(error).toHaveAttribute("role", "alert");
  });

  // No debe poder usarse para averiguar quién tiene cuenta en el sitio.
  //
  // Depende de poder enviar correo de verdad: el proveedor integrado de
  // Supabase admite 2 mensajes por hora en todo el proyecto, así que sin SMTP
  // propio este camino falla por agotamiento y no por un fallo del código.
  // No se silencia un fallo — se declara una dependencia de entorno, igual que
  // hacen los tests de integración cuando falta la base de datos.
  test("la confirmación no revela si el correo tenía cuenta", async ({ page }) => {
    test.skip(
      !process.env.EMAIL_ENVIABLE,
      "Requiere SMTP propio configurado (EMAIL_ENVIABLE=1). Ver HU-018."
    );

    await page.goto("/acceder");
    await page.locator("#email").fill(`zzz-e2e-${Date.now()}@example.com`);
    await page.getByRole("button", { name: /Enviarme el enlace/i }).click();

    const aviso = page.getByRole("status");
    await expect(aviso).toContainText(/revisa tu correo/i);
    // "Si esa dirección puede usarse" — condicional, no afirma que exista.
    await expect(aviso).toContainText(/si esa dirección/i);
  });

  test("un enlace de acceso inválido devuelve a la página de acceso, sin error crudo", async ({
    page,
  }) => {
    await page.goto("/acceder/callback?code=codigo-inventado");

    await expect(page).toHaveURL(/\/acceder\?error=enlace/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Entrar en tu cuenta");
  });

  test("la política de privacidad ya no afirma que no hay cuentas", async ({ page }) => {
    await page.goto("/privacidad");

    const main = page.locator("main");
    await expect(main).not.toContainText("No hay registro ni cuentas de usuario");
    // Y sí declara lo que ahora ocurre.
    await expect(main).toContainText(/si creas una cuenta/i);
    await expect(main).toContainText(/cookies necesarias para mantener la sesión/i);
    await expect(main).toContainText(/no usamos contraseñas/i);
  });
});
