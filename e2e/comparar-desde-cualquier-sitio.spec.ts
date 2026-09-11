import { expect, test } from "@playwright/test";

// HU-031 — empezar a comparar desde la ficha.
//
// Sus otros tres criterios («Comparar este curso» lleva a /buscar con el
// curso marcado, «Añadir a la comparación» desde /comparar y el aviso de
// comparación llena) los sustituyó HU-041: la ficha ya no lleva la
// comparación en su URL, sino que añade o quita de la cesta de comparación.
// Sus equivalentes están en cesta-ficha-y-favoritos.spec.ts, incluido el
// enlace a /buscar?preseleccionado= que sigue siendo el camino sin JavaScript.

test.describe("HU-031 — empezar a comparar desde la ficha", () => {
  test("los enlaces nuevos son autocontenidos: funcionan abiertos directamente", async ({
    page,
    context,
  }) => {
    await page.goto("/buscar");
    const primerId = await page.locator('input[name="ids"]').first().getAttribute("value");

    const directa = await context.newPage();
    await directa.goto(`/buscar?preseleccionado=${primerId}`);
    await expect(directa.locator(`input[name="ids"][value="${primerId}"]`)).toBeChecked();
    await directa.close();
  });
});
