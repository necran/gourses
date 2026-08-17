// @vitest-environment node
//
// HU-021. La lógica de decidir ya está cubierta a fondo en los unitarios; lo que
// se prueba aquí es la otra mitad, la que esos no pueden ver: que la consulta
// reúna bien los datos —precio actual, anterior del histórico, último avisado— y
// que el job respete la preferencia de cada persona.
//
// El enviador es de mentira y se queda con lo enviado, así que no sale ningún
// correo de verdad.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { runAlertasPrecioJob } from "../../src/lib/alertas/job.ts";
import type { EnviadorCorreo } from "../../src/lib/alertas/enviar.ts";
import type { MensajeAviso } from "../../src/lib/alertas/mensaje.ts";

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configurado = databaseUrl && supabaseUrl && serviceKey;
const describeIfConfigured = configurado ? describe : describe.skip;

const SUFIJO = Date.now();
const SOURCE_ID = `test-hu021-${SUFIJO}`;

function enviadorEspia() {
  const enviados: Array<{ destinatario: string; mensaje: MensajeAviso }> = [];
  const enviador: EnviadorCorreo = {
    nombre: "espía",
    async enviar(destinatario, mensaje) {
      enviados.push({ destinatario, mensaje });
    },
  };
  return { enviador, enviados };
}

describeIfConfigured("HU-021 — job de avisos de bajada", () => {
  // `describe.skip` ejecuta igualmente el cuerpo del bloque, así que crear aquí
  // el cliente sin comprobar antes rompe la suite unitaria de quien no tenga las
  // variables puestas. De ahí el ternario, igual que en los demás ficheros.
  const admin = configurado
    ? createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false } })
    : null;
  let client: Client;
  let usuarioId = "";
  let correo = "";
  let cursoId = "";

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();

    correo = `zzz-hu021-${SUFIJO}@example.com`;
    const { data } = await admin!.auth.admin.createUser({ email: correo, email_confirm: true });
    usuarioId = data!.user!.id;

    const { rows } = await client.query(
      `insert into courses (source, source_id, title, price_amount, price_currency)
       values ('udemy', $1, 'Curso de prueba HU-021', 20.00, 'EUR') returning id`,
      [SOURCE_ID]
    );
    cursoId = rows[0].id;

    await client.query(`insert into favorites (user_id, course_id) values ($1, $2)`, [
      usuarioId,
      cursoId,
    ]);
  }, 60_000);

  afterAll(async () => {
    if (usuarioId) await admin!.auth.admin.deleteUser(usuarioId);
    await client.query(`delete from courses where source_id = $1`, [SOURCE_ID]);
    await client.end();
  }, 60_000);

  // Cada caso parte del mismo estado: precio 20, un histórico a 50, sin avisos
  // previos y con los avisos activados.
  beforeEach(async () => {
    await client.query(`delete from price_alerts_sent where user_id = $1`, [usuarioId]);
    await client.query(`delete from alert_preferences where user_id = $1`, [usuarioId]);
    await client.query(`delete from course_price_history where course_id = $1`, [cursoId]);
    await client.query(
      `update courses set price_amount = 20.00, price_currency = 'EUR' where id = $1`,
      [cursoId]
    );
    await client.query(
      `insert into course_price_history (course_id, price_amount, price_currency, captured_at)
       values ($1, 50.00, 'EUR', now() - interval '1 day')`,
      [cursoId]
    );
  });

  it("avisa de una bajada de un curso guardado", async () => {
    const { enviador, enviados } = enviadorEspia();
    const r = await runAlertasPrecioJob({ client, enviador, log: () => {} });

    expect(r.enviados).toBe(1);
    expect(enviados).toHaveLength(1);
    expect(enviados[0].destinatario).toBe(correo);
    expect(enviados[0].mensaje.texto).toContain("50.00 EUR");
    expect(enviados[0].mensaje.texto).toContain("20.00 EUR");
  }, 60_000);

  // El job corre a diario: sin esto, el mismo correo saldría cada mañana.
  it("no repite el aviso en una segunda ejecución", async () => {
    const primera = enviadorEspia();
    await runAlertasPrecioJob({ client, enviador: primera.enviador, log: () => {} });
    expect(primera.enviados).toHaveLength(1);

    const segunda = enviadorEspia();
    const r = await runAlertasPrecioJob({ client, enviador: segunda.enviador, log: () => {} });

    expect(r.enviados).toBe(0);
    expect(segunda.enviados).toHaveLength(0);
    expect(r.descartados["ya-avisado"]).toBe(1);
  }, 60_000);

  it("vuelve a avisar si baja todavía más", async () => {
    await runAlertasPrecioJob({ client, enviador: enviadorEspia().enviador, log: () => {} });

    await client.query(`update courses set price_amount = 10.00 where id = $1`, [cursoId]);

    const { enviador, enviados } = enviadorEspia();
    const r = await runAlertasPrecioJob({ client, enviador, log: () => {} });

    expect(r.enviados).toBe(1);
    expect(enviados[0].mensaje.texto).toContain("10.00 EUR");
  }, 60_000);

  it("no avisa si el precio ha subido", async () => {
    await client.query(`update courses set price_amount = 80.00 where id = $1`, [cursoId]);

    const { enviador, enviados } = enviadorEspia();
    const r = await runAlertasPrecioJob({ client, enviador, log: () => {} });

    expect(r.enviados).toBe(0);
    expect(enviados).toHaveLength(0);
  }, 60_000);

  it("no avisa de un curso que no está en favoritos", async () => {
    await client.query(`delete from favorites where user_id = $1 and course_id = $2`, [
      usuarioId,
      cursoId,
    ]);

    const { enviador, enviados } = enviadorEspia();
    await runAlertasPrecioJob({ client, enviador, log: () => {} });
    expect(enviados.some((e) => e.destinatario === correo)).toBe(false);

    await client.query(`insert into favorites (user_id, course_id) values ($1, $2)`, [
      usuarioId,
      cursoId,
    ]);
  }, 60_000);

  it("respeta a quien ha desactivado los avisos", async () => {
    await client.query(
      `insert into alert_preferences (user_id, price_alerts_enabled) values ($1, false)`,
      [usuarioId]
    );

    const { enviador, enviados } = enviadorEspia();
    await runAlertasPrecioJob({ client, enviador, log: () => {} });

    expect(enviados.some((e) => e.destinatario === correo)).toBe(false);
  }, 60_000);

  // Si el envío falla no debe quedar anotado como enviado: mañana hay que
  // reintentarlo, no perder el aviso para siempre.
  it("un envío fallido no se anota, y se reintenta a la siguiente", async () => {
    const roto: EnviadorCorreo = {
      nombre: "roto",
      async enviar() {
        throw new Error("Resend respondió 500 al enviar el aviso.");
      },
    };

    const r = await runAlertasPrecioJob({ client, enviador: roto, log: () => {} });
    expect(r.fallidos).toBe(1);
    expect(r.enviados).toBe(0);

    const { rows } = await client.query(
      `select count(*)::int as n from price_alerts_sent where user_id = $1 and course_id = $2`,
      [usuarioId, cursoId]
    );
    expect(rows[0].n).toBe(0);

    // Y al reintentar con un enviador que funciona, el aviso sale.
    const { enviador, enviados } = enviadorEspia();
    await runAlertasPrecioJob({ client, enviador, log: () => {} });
    expect(enviados).toHaveLength(1);
  }, 60_000);
});
