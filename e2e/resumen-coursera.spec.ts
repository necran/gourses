import { expect, test } from "@playwright/test";
import { Client } from "pg";

// HU-052. El único criterio visible desde la web: un curso de Coursera con
// resumen lo muestra igual que uno de Udemy. Generarlo se prueba en unitarios e
// integración con un generador falso.

test.describe("HU-052 — resúmenes también para Coursera", () => {
  test("la ficha de un curso de Coursera muestra su resumen, marcado como generado", async ({
    page,
  }) => {
    const databaseUrl = process.env.DATABASE_URL;
    test.skip(!databaseUrl, "Requiere DATABASE_URL para sembrar el curso");

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    const sourceId = `zzz-hu052-coursera-${Date.now()}`;

    try {
      const { rows } = await client.query(
        `insert into courses (source, source_id, title, description, language, resumen_ia, resumen_ia_generado_en)
         values ('coursera', $1, 'Curso HU-052 de Coursera',
                 'Descripción original de la plataforma, tal cual la publica Coursera.',
                 'es', 'Aprenderás los fundamentos de la materia con ejercicios guiados.', now())
         returning id`,
        [sourceId]
      );

      await page.goto(`/curso/${rows[0].id}`);

      await expect(
        page.getByText("Aprenderás los fundamentos de la materia con ejercicios guiados.")
      ).toBeVisible();
      await expect(page.getByText(/generado autom[aá]ticamente/i)).toBeVisible();
      await expect(
        page.getByText("Descripción original de la plataforma, tal cual la publica Coursera.")
      ).toBeVisible();
    } finally {
      await client.query(`delete from courses where source_id = $1`, [sourceId]);
      await client.end();
    }
  });
});
