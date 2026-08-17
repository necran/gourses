import { expect, test } from "@playwright/test";

const PAGINAS = [
  { ruta: "/aviso-legal", titulo: "Aviso legal" },
  { ruta: "/privacidad", titulo: "Política de privacidad" },
  { ruta: "/afiliacion", titulo: "Cómo ganamos dinero" },
];

test.describe("HU-013 — páginas legales", () => {
  for (const { ruta, titulo } of PAGINAS) {
    test(`${ruta} carga y se identifica`, async ({ page }) => {
      await page.goto(ruta);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(titulo);
    });
  }

  // Deben ser alcanzables desde cualquier parte del sitio, no solo desde la
  // portada: por eso el pie va en el layout raíz.
  for (const desde of ["/", "/buscar"]) {
    test(`son alcanzables desde ${desde}`, async ({ page }) => {
      await page.goto(desde);

      const pie = page.getByRole("navigation", { name: "Enlaces legales" });
      await expect(pie.getByRole("link", { name: "Aviso legal" })).toBeVisible();
      await expect(pie.getByRole("link", { name: "Privacidad" })).toBeVisible();

      await pie.getByRole("link", { name: "Cómo ganamos dinero" }).click();
      await expect(page).toHaveURL(/\/afiliacion$/);
    });
  }

  test("la privacidad declara la carga de imágenes desde terceros", async ({ page }) => {
    await page.goto("/privacidad");

    const main = page.locator("main");
    await expect(main).toContainText(/im[áa]genes/i);
    await expect(main).toContainText(/udemy/i);
    await expect(main).toContainText(/coursera/i);
    await expect(main).toContainText(/direcci[óo]n ip/i);
  });

  // La política debe describir lo que el sitio hace de verdad, ni más ni
  // menos. Desde HU-018 hay cookies de sesión, así que ya no puede afirmar que
  // no usa ninguna; lo que sigue siendo cierto es que no hay analítica ni
  // rastreo, y eso debe seguir declarándose.
  test("la privacidad describe el uso real de cookies y analítica", async ({ page }) => {
    await page.goto("/privacidad");

    const main = page.locator("main");
    await expect(main).toContainText(/no usamos herramientas de anal[íi]tica/i);
    await expect(main).toContainText(/no usamos cookies de publicidad ni de seguimiento/i);

    // Y declara las que sí hay, en vez de callarlas.
    await expect(main).toContainText(/cookies necesarias para mantener la sesión/i);
    await expect(main).not.toContainText(/no usamos cookies propias/i);
  });

  test("la afiliación explica la comisión y que no encarece el precio", async ({ page }) => {
    await page.goto("/afiliacion");

    const main = page.locator("main");
    await expect(main).toContainText(/comisi[óo]n/i);
    await expect(main).toContainText(/no te cuesta ni un c[ée]ntimo m[áa]s/i);
    await expect(main).toContainText(/orden de los resultados/i);
  });

  test("la ficha de curso avisa de que el enlace puede ser de afiliado", async ({ page }) => {
    await page.goto("/buscar");
    await page.locator("main li h2 a").first().click();

    const aviso = page.getByText(/enlace de afiliado/i);
    await expect(aviso).toBeVisible();
    await expect(aviso.getByRole("link", { name: /m[áa]s informaci[óo]n/i })).toBeVisible();
  });
});
