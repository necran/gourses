// @vitest-environment node
//
// HU-066. Contra la base de desarrollo, como los avisos de HU-021: el boletín
// cuelga de `auth.users`, que la base de test no tiene. Se crea un usuario de
// prueba con la API de administración, un curso marcado con una bajada, y se
// borran al terminar. El enviador es un espía: no sale ningún correo.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { runBoletinJob } from "../../src/lib/boletin/job.ts";
import type { EnviadorCorreo } from "../../src/lib/alertas/enviar.ts";
import type { MensajeAviso } from "../../src/lib/alertas/mensaje.ts";

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const configurado = databaseUrl && supabaseUrl && serviceKey && anonKey;
const describeIfConfigured = configurado ? describe : describe.skip;

const SUFIJO = Date.now();
const SOURCE_ID = `test-hu066-${SUFIJO}`;
const TITULO = `Curso de prueba HU-066 ${SUFIJO}`;

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

describeIfConfigured("HU-066 — boletín semanal", () => {
  const admin = configurado ? createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false } }) : null;
  let client: Client;
  let usuarioId = "";
  let correo = "";

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();

    correo = `zzz-hu066-${SUFIJO}@example.com`;
    const { data } = await admin!.auth.admin.createUser({ email: correo, email_confirm: true });
    usuarioId = data!.user!.id;

    // Un curso en español publicado ayer, que ha bajado de 50 a 10 hace dos días.
    const { rows } = await client.query(
      `insert into courses (source, source_id, title, language, price_amount, price_currency, publicado_en)
       values ('udemy', $1, $2, 'es', 10.00, 'EUR', now() - interval '1 day') returning id`,
      [SOURCE_ID, TITULO]
    );
    await client.query(
      `insert into course_price_history (course_id, price_amount, price_currency, captured_at)
       values ($1, 50.00, 'EUR', now() - interval '5 days'), ($1, 10.00, 'EUR', now() - interval '2 days')`,
      [rows[0].id]
    );
  }, 60_000);

  afterAll(async () => {
    if (usuarioId) await admin!.auth.admin.deleteUser(usuarioId);
    await client.query(`delete from courses where source_id = $1`, [SOURCE_ID]);
    await client.end();
  }, 60_000);

  beforeEach(async () => {
    await client.query(`delete from boletines_enviados where user_id = $1`, [usuarioId]);
    await client.query(`delete from boletin_suscripciones where user_id = $1`, [usuarioId]);
  });

  const alUsuario = <T extends { destinatario: string }>(enviados: T[]) =>
    enviados.filter((e) => e.destinatario === correo);

  it("no envía a quien no se ha apuntado", async () => {
    const { enviador, enviados } = enviadorEspia();
    await runBoletinJob({ client, enviador, log: () => {} });
    expect(alUsuario(enviados)).toHaveLength(0);

    await client.query(`insert into boletin_suscripciones (user_id, activo) values ($1, false)`, [usuarioId]);
    await runBoletinJob({ client, enviador, log: () => {} });
    expect(alUsuario(enviados)).toHaveLength(0);
  }, 60_000);

  it("envía a quien está apuntado, con el curso nuevo, la bajada y su enlace de baja", async () => {
    const { rows } = await client.query(
      `insert into boletin_suscripciones (user_id, activo, consentido_en) values ($1, true, now()) returning token_baja`,
      [usuarioId]
    );
    const { enviador, enviados } = enviadorEspia();
    const r = await runBoletinJob({ client, enviador, log: () => {} });

    const suyos = alUsuario(enviados);
    expect(suyos).toHaveLength(1);
    expect(r.sinContenido).toBe(false);
    const { texto } = suyos[0].mensaje;
    expect(texto).toContain("CURSOS NUEVOS EN ESPAÑOL");
    // La bajada de 50 a 10 es de las más grandes posibles: tiene que estar.
    expect(texto).toMatch(new RegExp(`${TITULO} \\(Udemy\\): antes 50,00 EUR, ahora 10,00 EUR \\(-80 %\\)`));
    expect(texto).toContain(`/boletin/baja?t=${rows[0].token_baja}`);
  }, 60_000);

  it("no repite el envío si el job se ejecuta dos veces la misma semana", async () => {
    await client.query(`insert into boletin_suscripciones (user_id, activo) values ($1, true)`, [usuarioId]);
    const { enviador, enviados } = enviadorEspia();
    await runBoletinJob({ client, enviador, log: () => {} });
    await runBoletinJob({ client, enviador, log: () => {} });
    expect(alUsuario(enviados)).toHaveLength(1);
  }, 60_000);

  it("si el envío falla, no se anota y el siguiente intento lo reintenta", async () => {
    await client.query(`insert into boletin_suscripciones (user_id, activo) values ($1, true)`, [usuarioId]);
    const falla: EnviadorCorreo = {
      nombre: "falla",
      async enviar() {
        throw new Error("Resend respondió 500");
      },
    };
    await runBoletinJob({ client, enviador: falla, log: () => {} });

    const { enviador, enviados } = enviadorEspia();
    await runBoletinJob({ client, enviador, log: () => {} });
    expect(alUsuario(enviados)).toHaveLength(1);
  }, 60_000);

  it("la baja con el token, sin sesión, desactiva solo esa suscripción", async () => {
    const { rows } = await client.query(
      `insert into boletin_suscripciones (user_id, activo) values ($1, true) returning token_baja`,
      [usuarioId]
    );
    const anon = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });

    const otro = await anon.rpc("baja_boletin", { p_token: "00000000-0000-4000-8000-000000000000" });
    expect(otro.error).toBeNull();
    expect(otro.data).toBe(false);

    const suya = await anon.rpc("baja_boletin", { p_token: rows[0].token_baja });
    expect(suya.error).toBeNull();
    expect(suya.data).toBe(true);

    const { rows: despues } = await client.query(`select activo from boletin_suscripciones where user_id = $1`, [
      usuarioId,
    ]);
    expect(despues[0].activo).toBe(false);
  }, 60_000);

  it("sin sesión no se pueden leer suscripciones ni envíos (RLS)", async () => {
    await client.query(`insert into boletin_suscripciones (user_id, activo) values ($1, true)`, [usuarioId]);
    await client.query(`insert into boletines_enviados (user_id, semana) values ($1, current_date)`, [usuarioId]);
    const anon = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });

    const suscripciones = await anon.from("boletin_suscripciones").select("user_id, token_baja");
    expect(suscripciones.data ?? []).toHaveLength(0);
    const envios = await anon.from("boletines_enviados").select("user_id");
    expect(envios.data ?? []).toHaveLength(0);
  }, 60_000);
});
