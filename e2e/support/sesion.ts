import type { BrowserContext } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Abre una sesión en el navegador de pruebas sin pasar por el correo (HU-019).
//
// El camino real —formulario, correo, enlace— no se puede recorrer aquí: el
// proveedor integrado de Supabase admite 2 mensajes por hora en todo el
// proyecto. Así que la sesión se obtiene con la API de administración y se
// canjea igual que hace el navegador.
//
// Las cookies **no se construyen a mano**: se le pide a `@supabase/ssr`, la
// misma librería que usa la web, que las serialice. Si mañana cambia el formato
// o el troceado, estos tests siguen siendo válidos porque no saben nada de él.
// Fabricarlas a mano sería inventarse un formato y acabar probando esa
// invención en vez del sitio.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const HAY_CREDENCIALES = Boolean(url && anonKey && serviceKey);

export function clienteAdmin(): SupabaseClient {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export interface SesionDePrueba {
  userId: string;
  correo: string;
}

export async function abrirSesion(
  context: BrowserContext,
  correo: string
): Promise<SesionDePrueba> {
  const admin = clienteAdmin();

  // Si la cuenta ya existe se sigue adelante: hace falta poder volver a entrar
  // con el mismo correo para comprobar que lo guardado sigue ahí tras salir.
  await admin.auth.admin.createUser({ email: correo, email_confirm: true });

  const { data: enlace, error: errorEnlace } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: correo,
  });
  if (errorEnlace) throw new Error(`No se pudo generar el enlace: ${errorEnlace.message}`);

  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: sesion, error: errorCanje } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: enlace!.properties!.hashed_token,
  });
  if (errorCanje) throw new Error(`No se pudo canjear el enlace: ${errorCanje.message}`);

  // Se deja que la librería escriba las cookies de esta sesión y se recogen.
  const recogidas: Array<{ name: string; value: string }> = [];
  const ssr = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: (nuevas) => {
        for (const { name, value } of nuevas) recogidas.push({ name, value });
      },
    },
  });
  await ssr.auth.setSession({
    access_token: sesion.session!.access_token,
    refresh_token: sesion.session!.refresh_token,
  });

  if (recogidas.length === 0) {
    throw new Error("La librería no emitió ninguna cookie de sesión; el ayudante está roto.");
  }

  await context.addCookies(
    recogidas.map((c) => ({
      name: c.name,
      value: c.value,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax" as const,
    }))
  );

  return { userId: sesion.user!.id, correo };
}

// Borra la cuenta de prueba; sus favoritos se van en cascada.
export async function borrarUsuario(userId: string): Promise<void> {
  await clienteAdmin().auth.admin.deleteUser(userId);
}
