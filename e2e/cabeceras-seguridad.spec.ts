import { expect, test } from "@playwright/test";

// HU-034. Antes estas cabeceras vivían solo en netlify.toml y en producción
// llegaban a medias. Ahora las emite Next.js desde next.config.ts, así que
// valen también en `next dev` y se pueden comprobar aquí sin desplegar.

const esperadas: Record<string, string> = {
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

test.describe("HU-034 — cabeceras de seguridad", () => {
  for (const ruta of ["/", "/buscar"]) {
    test(`${ruta} responde con las cinco cabeceras de seguridad`, async ({ page }) => {
      const respuesta = await page.goto(ruta);
      const cabeceras = respuesta!.headers();

      for (const [clave, valor] of Object.entries(esperadas)) {
        expect(cabeceras[clave], `${ruta} → ${clave}`).toBe(valor);
      }
    });
  }

  test("una ficha de curso también las lleva", async ({ page }) => {
    await page.goto("/buscar");
    const href = await page.locator("main li h2 a").first().getAttribute("href");
    const respuesta = await page.goto(href!);
    const cabeceras = respuesta!.headers();

    for (const [clave, valor] of Object.entries(esperadas)) {
      expect(cabeceras[clave], `${href} → ${clave}`).toBe(valor);
    }
  });
});
