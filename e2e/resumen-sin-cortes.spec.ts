import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { resumenDefectuoso } from "../src/lib/ia/resumen-curso";

// Criterio visible de HU-068: lo que se lee en la ficha es un resumen entero, no
// media frase. Se comprueba sobre cursos reales del catálogo —no sembrados—,
// porque el fallo que motivó la historia estaba precisamente en lo guardado: 16
// resúmenes cortados a media palabra que ninguna regla detectaba.

async function fichasConResumen(cuantas: number): Promise<Array<{ id: string; resumen: string }>> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    // Los más cortos primero: si queda alguno cortado, está entre estos.
    //
    // Sin las filas que siembran otros tests (`zzz-`, `test-`): son temporales y
    // sus resúmenes de mentira («Este curso enseña X e Y de forma práctica.») no
    // salen del job, que es lo que esta historia comprueba. Corriendo en
    // paralelo, una de esas filas se colaba aquí y hacía fallar el test.
    const { rows } = await client.query(
      `select id, resumen_ia from courses
        where resumen_ia is not null
          and source_id not like 'zzz-%'
          and source_id not like 'test-%'
        order by length(resumen_ia), id
        limit $1`,
      [cuantas]
    );
    return rows.map((r) => ({ id: r.id, resumen: r.resumen_ia }));
  } finally {
    await client.end();
  }
}

test.describe("HU-068 — el resumen de la ficha no se corta a media palabra", () => {
  test("los resúmenes más cortos del catálogo son frases enteras", async ({ page }) => {
    test.skip(!process.env.DATABASE_URL, "Requiere DATABASE_URL para elegir cursos reales");

    const fichas = await fichasConResumen(5);
    test.skip(fichas.length === 0, "Todavía no hay ningún resumen generado en esta base");

    for (const ficha of fichas) {
      await page.goto(`/curso/${ficha.id}`);
      const visible = (await page.getByText(ficha.resumen).first().textContent())?.trim() ?? "";

      expect(visible, `curso ${ficha.id}`).not.toBe("");
      expect(resumenDefectuoso(visible), `curso ${ficha.id}: «${visible}»`).toBe(false);
    }
  });
});
