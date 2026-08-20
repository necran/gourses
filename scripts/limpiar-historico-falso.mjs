// Limpieza puntual del histórico contaminado por el fallo de precios borrados.
//
// Antes de que `priceUnknown` existiera, cada 429 en la llamada de detalle de
// Udemy machacaba el precio guardado con null y apuntaba esa "bajada" en
// course_price_history. Esas filas no son solo ruido: el detector de HU-021
// mira el último precio anterior y, si es null, devuelve "sin-referencia" y no
// avisa — o sea que silencian avisos legítimos hasta el siguiente cambio real.
//
// Solo borra filas demostrablemente falsas: precio null, de un curso de Udemy
// que en algún momento SÍ tuvo precio. Un curso que nunca lo ha tenido se deja
// como está, porque ahí no se puede afirmar que el null fuese un fallo.
//
// Es idempotente: pasarlo dos veces no borra nada la segunda vez.
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Falta DATABASE_URL en el entorno.");
  process.exit(1);
}

const FALSAS = `
  from course_price_history h
  where h.price_amount is null
    and exists (select 1 from courses c where c.id = h.course_id and c.source = 'udemy')
    and exists (
      select 1 from course_price_history h2
      where h2.course_id = h.course_id and h2.price_amount is not null
    )`;

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  const antes = (await client.query("select count(*)::int n from course_price_history")).rows[0].n;
  const falsas = (await client.query(`select count(*)::int n ${FALSAS}`)).rows[0].n;
  console.log(`Histórico antes: ${antes}. Filas falsas detectadas: ${falsas}.`);

  if (falsas === 0) {
    console.log("Nada que limpiar.");
  } else {
    await client.query("begin");
    const { rowCount } = await client.query(`delete ${FALSAS}`);

    // Dos comprobaciones antes de confirmar. Si cualquiera falla se deshace
    // todo: más vale dejar el histórico sucio que dejarlo mal.
    if (rowCount !== falsas) {
      await client.query("rollback");
      throw new Error(`Iba a borrar ${falsas} filas y borró ${rowCount}; no se confirma nada.`);
    }

    const { rows } = await client.query(`
      select count(*)::int n from courses c
      where c.price_amount is not null
        and not exists (select 1 from course_price_history h where h.course_id = c.id)`);
    if (rows[0].n > 0) {
      await client.query("rollback");
      throw new Error(`${rows[0].n} cursos con precio se quedarían sin histórico; no se confirma nada.`);
    }

    await client.query("commit");
    const despues = (await client.query("select count(*)::int n from course_price_history")).rows[0].n;
    console.log(`Borradas ${rowCount} filas. Histórico después: ${despues}.`);
  }
} finally {
  await client.end();
}
