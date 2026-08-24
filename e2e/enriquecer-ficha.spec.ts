import { expect, test } from "@playwright/test";
import { Client } from "pg";

// Un test por criterio de aceptación de HU-029 que se ve desde la web. La
// ingesta en sí (que el detalle real sustituye al titular, y que un fallo
// conserva lo que ya había) se prueba en unitarios e integración: aquí no hay
// forma de simular un fallo de la API de Udemy desde el navegador.

test.describe("HU-029 — enriquecer la ficha con los datos reales de Udemy", () => {
  test("«Lo que aprenderás» y los requisitos se muestran como listas cuando existen", async ({
    page,
  }) => {
    const databaseUrl = process.env.DATABASE_URL;
    test.skip(!databaseUrl, "Requiere DATABASE_URL para sembrar el curso");

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    const sourceId = `zzz-hu029-listas-${Date.now()}`;

    try {
      const { rows } = await client.query(
        `insert into courses
          (source, source_id, title, what_you_will_learn, requirements, affiliate_url)
         values ('udemy', $1, 'Curso HU-029 con listas',
                 array['Aprender X', 'Dominar Y'], array['Saber Z'],
                 'https://www.udemy.com/course/hu029-listas/')
         returning id`,
        [sourceId]
      );

      await page.goto(`/curso/${rows[0].id}`);

      await expect(page.getByRole("heading", { name: "Lo que aprenderás" })).toBeVisible();
      await expect(page.locator("main")).toContainText("Aprender X");
      await expect(page.locator("main")).toContainText("Dominar Y");

      await expect(page.getByRole("heading", { name: "Requisitos" })).toBeVisible();
      await expect(page.locator("main")).toContainText("Saber Z");
    } finally {
      await client.query(`delete from courses where source_id = $1`, [sourceId]);
      await client.end();
    }
  });

  test("sin esos datos, las secciones no aparecen — no es un hueco vacío", async ({ page }) => {
    const databaseUrl = process.env.DATABASE_URL;
    test.skip(!databaseUrl, "Requiere DATABASE_URL para sembrar el curso");

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    const sourceId = `zzz-hu029-sinlistas-${Date.now()}`;

    try {
      const { rows } = await client.query(
        `insert into courses (source, source_id, title, affiliate_url)
         values ('coursera', $1, 'Curso HU-029 sin listas', 'https://www.coursera.org/learn/hu029/')
         returning id`,
        [sourceId]
      );

      await page.goto(`/curso/${rows[0].id}`);

      await expect(page.getByRole("heading", { name: "Lo que aprenderás" })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Requisitos" })).toHaveCount(0);
    } finally {
      await client.query(`delete from courses where source_id = $1`, [sourceId]);
      await client.end();
    }
  });

  test("con valoración y reseñas, los datos estructurados declaran AggregateRating", async ({
    page,
  }) => {
    const databaseUrl = process.env.DATABASE_URL;
    test.skip(!databaseUrl, "Requiere DATABASE_URL para sembrar el curso");

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    const sourceId = `zzz-hu029-rating-${Date.now()}`;

    try {
      const { rows } = await client.query(
        `insert into courses (source, source_id, title, rating, num_reviews, affiliate_url)
         values ('udemy', $1, 'Curso HU-029 con reseñas', 4.7, 1532,
                 'https://www.udemy.com/course/hu029-rating/')
         returning id`,
        [sourceId]
      );

      await page.goto(`/curso/${rows[0].id}`);

      const json = await page.locator('script[type="application/ld+json"]').textContent();
      const datos = JSON.parse(json!);

      expect(datos.aggregateRating).toEqual({
        "@type": "AggregateRating",
        ratingValue: 4.7,
        reviewCount: 1532,
      });

      // También visible para quien mira la página, no solo para el buscador.
      await expect(page.locator("main")).toContainText("1.532 reseñas");
    } finally {
      await client.query(`delete from courses where source_id = $1`, [sourceId]);
      await client.end();
    }
  });

  test("con valoración pero sin reseñas, no se declara AggregateRating", async ({ page }) => {
    const databaseUrl = process.env.DATABASE_URL;
    test.skip(!databaseUrl, "Requiere DATABASE_URL para sembrar el curso");

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    const sourceId = `zzz-hu029-sinresenas-${Date.now()}`;

    try {
      const { rows } = await client.query(
        `insert into courses (source, source_id, title, rating, affiliate_url)
         values ('udemy', $1, 'Curso HU-029 sin reseñas', 4.7,
                 'https://www.udemy.com/course/hu029-sinresenas/')
         returning id`,
        [sourceId]
      );

      await page.goto(`/curso/${rows[0].id}`);

      const json = await page.locator('script[type="application/ld+json"]').textContent();
      const datos = JSON.parse(json!);

      expect(datos.aggregateRating).toBeUndefined();
    } finally {
      await client.query(`delete from courses where source_id = $1`, [sourceId]);
      await client.end();
    }
  });
});
