// @vitest-environment node
//
// HU-037. Lo que hay que demostrar aquí no lo enseña la interfaz: es el
// comportamiento real de Supabase Auth con el cambio seguro de correo
// activado, que tiene dos particularidades nada obvias y las dos importan
// para no mentir en pantalla ni dejar un agujero de privacidad:
//
// 1. El cambio exige **dos** confirmaciones —correo actual y nuevo— y no se
//    aplica hasta que llegan las dos, en cualquier orden.
// 2. Pedir el cambio a un correo que ya tiene cuenta devuelve
//    `422 email_exists` **en el momento**, a diferencia del acceso
//    (`signInWithOtp`), que nunca distingue. Hay que taparlo a propósito
//    (`resultadoCambioCorreo`) o el formulario delataría quién está
//    registrado.
//
// Los dos enlaces de confirmación se leen de Mailpit, el buzón de desarrollo
// (ver docs/correo-resend.md): no hay forma de sacarlos de otro sitio, porque
// el token va solo en el cuerpo del correo y la API de administración no lo
// expone. `auth.audit_log_entries` tampoco sirve: PostgREST no publica el
// esquema `auth` («Only the following schemas are exposed»), así que
// MAILPIT_URL es el único camino; sin esa variable, este fichero entero se
// salta solo, igual que el e2e equivalente (EMAIL_ENVIABLE).
//
// Se habla con la API REST de Supabase directamente, sin pasar por
// `@supabase/ssr`: así las dos confirmaciones se comportan en modo no-PKCE
// (sin `code_challenge`), que es más simple de seguir y prueba exactamente lo
// mismo que importa aquí. El camino con PKCE que usa la app de verdad se
// comprobó a mano contra este mismo Supabase, incluida la distinción entre la
// respuesta `message` de la primera confirmación y el `code` de la segunda
// (ver el callback en src/app/mi-cuenta/correo/callback/route.ts).
import { afterAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const mailpitUrl = process.env.MAILPIT_URL;

const configurado = Boolean(supabaseUrl && anonKey && serviceKey && mailpitUrl);
const describeIfConfigured = configurado ? describe : describe.skip;

const SUFIJO = Date.now();
const usuariosCreados: string[] = [];

function unico(etiqueta: string): string {
  return `zzz-hu037-${etiqueta}-${SUFIJO}@example.com`;
}

async function crearUsuario(admin: SupabaseClient, correo: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({ email: correo, email_confirm: true });
  if (error) throw new Error(`No se pudo crear el usuario: ${error.message}`);
  usuariosCreados.push(data.user!.id);
  return data.user!.id;
}

// Sesión de un usuario ya existente, como la tendría el navegador tras entrar.
async function sesionDe(admin: SupabaseClient, correo: string): Promise<string> {
  const { data: enlace, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: correo,
  });
  if (error) throw new Error(`No se pudo generar el enlace: ${error.message}`);

  const r = await fetch(`${supabaseUrl}/auth/v1/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey! },
    body: JSON.stringify({ type: "magiclink", token_hash: enlace!.properties!.hashed_token }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`No se pudo canjear el enlace: ${JSON.stringify(j)}`);
  return j.access_token as string;
}

async function pedirCambioCorreo(
  accessToken: string,
  correoNuevo: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey!,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ email: correoNuevo }),
  });
  return { status: r.status, body: await r.json() };
}

// El token de confirmación más reciente enviado a esa dirección. Se reintenta
// unas veces porque el correo tarda un instante en llegar a Mailpit.
async function tokenDeConfirmacion(destinatario: string): Promise<string> {
  for (let intento = 0; intento < 10; intento++) {
    const j = await (await fetch(`${mailpitUrl}/api/v1/messages?limit=50`)).json();
    const mensaje = (j.messages ?? []).find((m: { To?: Array<{ Address: string }> }) =>
      m.To?.some((t) => t.Address === destinatario)
    );
    if (mensaje) {
      const detalle = await (await fetch(`${mailpitUrl}/api/v1/message/${mensaje.ID}`)).json();
      // El HTML trae `&amp;` entre parámetros, no `&` a secas.
      const cuerpo: string = (detalle.HTML || detalle.Text || "").replace(/&amp;/g, "&");
      const token = /[?&]token=((?:pkce_)?[a-f0-9]+)&type=email_change/.exec(cuerpo)?.[1];
      if (token) return token;
    }
    await new Promise((res) => setTimeout(res, 300));
  }
  throw new Error(`No llegó ningún correo de cambio de email a ${destinatario}`);
}

async function confirmar(token: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const r = await fetch(`${supabaseUrl}/auth/v1/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey! },
    body: JSON.stringify({ type: "email_change", token_hash: token }),
  });
  return { status: r.status, body: await r.json() };
}

describeIfConfigured("HU-037 — cambiar el correo de la cuenta", () => {
  const admin = configurado
    ? createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false } })
    : null;

  afterAll(async () => {
    if (!admin) return;
    for (const id of usuariosCreados) {
      await admin.auth.admin.deleteUser(id);
    }
  }, 60_000);

  it("pedir el cambio a un correo que ya tiene cuenta lo dice en el momento (422 email_exists)", async () => {
    const correoLibre = unico("existe-a");
    const correoOcupado = unico("existe-b");
    await crearUsuario(admin!, correoLibre);
    await crearUsuario(admin!, correoOcupado);

    const token = await sesionDe(admin!, correoLibre);
    const { status, body } = await pedirCambioCorreo(token, correoOcupado);

    expect(status).toBe(422);
    expect(body.error_code).toBe("email_exists");
  }, 30_000);

  it("pedir el cambio dos veces seguidas da el mismo límite que el acceso", async () => {
    const correo = unico("limite");
    await crearUsuario(admin!, correo);
    const token = await sesionDe(admin!, correo);

    const primero = await pedirCambioCorreo(token, unico("limite-destino-1"));
    expect(primero.status).toBe(200);

    const segundo = await pedirCambioCorreo(token, unico("limite-destino-2"));
    expect(segundo.status).toBe(429);
    expect(segundo.body.error_code).toBe("over_email_send_rate_limit");
  }, 30_000);

  it("el correo no cambia hasta confirmar las dos direcciones", async () => {
    const correoViejo = unico("parcial-viejo");
    const correoNuevo = unico("parcial-nuevo");
    const userId = await crearUsuario(admin!, correoViejo);
    const token = await sesionDe(admin!, correoViejo);

    await pedirCambioCorreo(token, correoNuevo);

    const antesDeConfirmar = await admin!.auth.admin.getUserById(userId);
    expect(antesDeConfirmar.data.user?.email).toBe(correoViejo);

    // Confirmar solo el enlace que llegó al correo nuevo.
    const tokenNuevo = await tokenDeConfirmacion(correoNuevo);
    const resultado = await confirmar(tokenNuevo);

    // La primera confirmación no establece sesión: éxito, sin tokens.
    expect(resultado.status).toBe(200);
    expect(resultado.body.access_token).toBeUndefined();

    const trasUna = await admin!.auth.admin.getUserById(userId);
    expect(trasUna.data.user?.email).toBe(correoViejo);
    expect(trasUna.data.user?.new_email).toBe(correoNuevo);
  }, 30_000);

  it("tras confirmar las dos, el correo cambia y el id de usuario y los favoritos se mantienen", async () => {
    const correoViejo = unico("completo-viejo");
    const correoNuevo = unico("completo-nuevo");
    const userId = await crearUsuario(admin!, correoViejo);

    // Un favorito de verdad, para comprobar que sigue ahí tras el cambio: la
    // clave primaria de `favorites` es `(user_id, course_id)`, así que si el
    // cambio de correo alterase el id de usuario, esta fila se quedaría
    // huérfana.
    const { data: curso } = await admin!
      .from("courses")
      .insert({ source: "udemy", source_id: `test-hu037-${SUFIJO}`, title: "Curso de prueba HU-037" })
      .select("id")
      .single();
    await admin!.from("favorites").insert({ user_id: userId, course_id: curso!.id });

    const token = await sesionDe(admin!, correoViejo);
    await pedirCambioCorreo(token, correoNuevo);

    const tokenViejo = await tokenDeConfirmacion(correoViejo);
    const tokenNuevo = await tokenDeConfirmacion(correoNuevo);

    const primera = await confirmar(tokenViejo);
    expect(primera.status).toBe(200);
    const segunda = await confirmar(tokenNuevo);
    expect(segunda.status).toBe(200);
    // La confirmación que completa el cambio sí establece sesión.
    expect(segunda.body.access_token).toBeTruthy();

    const final = await admin!.auth.admin.getUserById(userId);
    expect(final.data.user?.id).toBe(userId);
    expect(final.data.user?.email).toBe(correoNuevo);
    expect(final.data.user?.new_email).toBeFalsy();

    const { data: favoritosTrasCambio } = await admin!
      .from("favorites")
      .select("course_id")
      .eq("user_id", userId);
    expect(favoritosTrasCambio?.map((f) => f.course_id)).toEqual([curso!.id]);

    await admin!.from("courses").delete().eq("id", curso!.id);
  }, 30_000);
});
