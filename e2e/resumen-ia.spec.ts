import { expect, test } from "@playwright/test";
import { Client } from "pg";

// Un test por criterio de aceptación de HU-030 visible desde la web. Generar
// el resumen de verdad (la llamada a la API de Anthropic) se prueba en
// unitarios e integración con un generador falso — aquí solo se comprueba que
// la ficha lo muestra bien cuando ya existe en la base, marcado como
// generado y sin mezclarse con la descripción real.

test.describe("HU-030 — resumen de curso generado con IA", () => {
  test("con resumen guardado, se muestra marcado como generado automáticamente", async ({
    page,
  }) => {
    const databaseUrl = process.env.DATABASE_URL;
    test.skip(!databaseUrl, "Requiere DATABASE_URL para sembrar el curso");

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    const sourceId = `zzz-hu030-conresumen-${Date.now()}`;

    try {
      const { rows } = await client.query(
        `insert into courses (source, source_id, title, description, resumen_ia, resumen_ia_generado_en)
         values ('udemy', $1, 'Curso HU-030 con resumen',
                 'Descripción real y completa del curso, con todo lujo de detalles.',
                 'Este curso enseña X e Y de forma práctica.', now())
         returning id`,
        [sourceId]
      );

      await page.goto(`/curso/${rows[0].id}`);

      await expect(page.getByText("Este curso enseña X e Y de forma práctica.")).toBeVisible();
      await expect(page.getByText(/generado autom[aá]ticamente/i)).toBeVisible();

      // Y no se confunde con la descripción real: las dos están, por separado.
      await expect(page.getByRole("heading", { name: "Descripción" })).toBeVisible();
      await expect(
        page.getByText("Descripción real y completa del curso, con todo lujo de detalles.")
      ).toBeVisible();
    } finally {
      await client.query(`delete from courses where source_id = $1`, [sourceId]);
      await client.end();
    }
  });

  test("sin resumen guardado, no aparece nada — no es un hueco vacío", async ({ page }) => {
    const databaseUrl = process.env.DATABASE_URL;
    test.skip(!databaseUrl, "Requiere DATABASE_URL para sembrar el curso");

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    const sourceId = `zzz-hu030-sinresumen-${Date.now()}`;

    try {
      const { rows } = await client.query(
        `insert into courses (source, source_id, title, description)
         values ('coursera', $1, 'Curso HU-030 sin resumen', 'Una descripción cualquiera.')
         returning id`,
        [sourceId]
      );

      await page.goto(`/curso/${rows[0].id}`);

      await expect(page.getByText(/generado autom[aá]ticamente/i)).toHaveCount(0);
    } finally {
      await client.query(`delete from courses where source_id = $1`, [sourceId]);
      await client.end();
    }
  });
});
