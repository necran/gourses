// @vitest-environment node
//
// HU-038. Lo que hay que demostrar no es que la interfaz enseñe un botón, es
// que Supabase revoca de verdad: un token de refresco emitido antes del cierre
// global deja de servir para renovar sesión. Se prueba con `refreshSession`,
// que es exactamente lo que hace la librería del navegador cuando el token de
// acceso caduca — así no hace falta esperar a que caduque de verdad.
//
// La clave de servicio solo se usa para crear y borrar los usuarios de prueba
// y para generar los enlaces; el cierre en sí (`signOut`) se llama con la
// sesión del propio usuario, como en el navegador.
import { afterAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configurado = supabaseUrl && anonKey && serviceKey;
const describeIfConfigured = configurado ? describe : describe.skip;

const SUFIJO = Date.now();
const usuariosCreados: string[] = [];

async function crearUsuarioYSesion(
  admin: SupabaseClient,
  etiqueta: string
): Promise<{ userId: string; correo: string; sesion: SupabaseClient; refreshToken: string }> {
  const correo = `zzz-hu038-${etiqueta}-${SUFIJO}@example.com`;
  const { data: creado, error: errorCrear } = await admin.auth.admin.createUser({
    email: correo,
    email_confirm: true,
  });
  if (errorCrear) throw new Error(`No se pudo crear el usuario: ${errorCrear.message}`);
  usuariosCreados.push(creado!.user!.id);

  const sesion = await sesionDe(admin, correo);
  const { data } = await sesion.auth.getSession();

  return { userId: creado!.user!.id, correo, sesion, refreshToken: data.session!.refresh_token };
}

// Un cliente nuevo con sesión propia, como si fuera un dispositivo nuevo
// entrando con el enlace del correo. Llamarla dos veces para el mismo correo
// da dos sesiones independientes —dos «dispositivos»— del mismo usuario.
async function sesionDe(admin: SupabaseClient, correo: string): Promise<SupabaseClient> {
  const { data: enlace, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: correo,
  });
  if (error) throw new Error(`No se pudo generar el enlace: ${error.message}`);

  const cliente = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
  const { error: errorCanje } = await cliente.auth.verifyOtp({
    type: "magiclink",
    token_hash: enlace!.properties!.hashed_token,
  });
  if (errorCanje) throw new Error(`No se pudo canjear el enlace: ${errorCanje.message}`);

  return cliente;
}

describeIfConfigured("HU-038 — cerrar sesión en todos los dispositivos", () => {
  const admin = configurado
    ? createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false } })
    : null;

  afterAll(async () => {
    if (!admin) return;
    for (const id of usuariosCreados) {
      await admin.auth.admin.deleteUser(id);
    }
  }, 60_000);

  it("tras el cierre global, un token de refresco previo del mismo usuario no renueva sesión", async () => {
    const { sesion: dispositivo1 } = await crearUsuarioYSesion(admin!, "renovar-a");
    const correo = (await dispositivo1.auth.getUser()).data.user!.email!;
    // «Segundo dispositivo»: otra sesión del mismo usuario, con su propio
    // token de refresco.
    const dispositivo2 = await sesionDe(admin!, correo);
    const { data: sesion2 } = await dispositivo2.auth.getSession();
    const refreshToken2 = sesion2.session!.refresh_token;

    const { error: errorCierre } = await dispositivo1.auth.signOut({ scope: "global" });
    expect(errorCierre).toBeNull();

    // Un cliente nuevo intentando renovar con el token del segundo dispositivo:
    // es justo lo que haría ese navegador al necesitar un token de acceso
    // nuevo. Debe fallar — el cierre global ya lo revocó.
    const otroCliente = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data: renovada, error: errorRenovar } = await otroCliente.auth.refreshSession({
      refresh_token: refreshToken2,
    });

    expect(errorRenovar).not.toBeNull();
    expect(renovada.session).toBeNull();
  }, 30_000);

  it("el cierre global de A no revoca la sesión de B", async () => {
    const { sesion: sesionA } = await crearUsuarioYSesion(admin!, "aislar-a");
    const { refreshToken: refreshTokenB } = await crearUsuarioYSesion(admin!, "aislar-b");

    await sesionA.auth.signOut({ scope: "global" });

    // B sigue pudiendo renovar la suya con normalidad.
    const otroCliente = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await otroCliente.auth.refreshSession({
      refresh_token: refreshTokenB,
    });

    expect(error).toBeNull();
    expect(data.session).not.toBeNull();
  }, 30_000);
});
