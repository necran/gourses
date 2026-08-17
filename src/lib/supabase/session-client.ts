import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

// Cliente con sesión, para las páginas que necesitan saber quién es el
// visitante (HU-018). Usa la **clave anónima**, igual que el resto del sitio:
// quien decide qué puede ver cada persona es la RLS, no esta capa.
//
// `SUPABASE_SERVICE_ROLE_KEY` no aparece aquí ni debe aparecer nunca en código
// alcanzable desde una página: saltaría la RLS por completo
// (ver .claude/rules/seguridad.md).
export async function createSupabaseSessionClient(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno."
    );
  }

  const almacen = await cookies();

  return createServerClient(url, anonKey, {
    // @supabase/ssr trae `httpOnly: false` por defecto, pensando en apps que
    // leen la sesión desde el navegador. Esta no lo hace: no hay
    // `createBrowserClient` en el repo y la sesión solo se consulta en el
    // servidor. Dejar la cookie legible por JavaScript solo añadiría un
    // objetivo — dentro va el token de refresco, que dura meses.
    cookieOptions: {
      httpOnly: true,
      // En desarrollo el NAS se sirve por http://, donde una cookie `secure`
      // no viaja y no habría sesión.
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll() {
        return almacen.getAll();
      },
      setAll(nuevas) {
        try {
          for (const { name, value, options } of nuevas) {
            almacen.set(name, value, options);
          }
        } catch {
          // Los componentes de servidor no pueden escribir cookies; ahí solo se
          // lee la sesión. La renovación ocurre en el callback y en las
          // acciones de servidor, que sí pueden.
        }
      },
    },
  });
}

// Devuelve el usuario autenticado, o null. Se usa `getUser()` y no
// `getSession()` a propósito: `getUser()` valida el token contra el servidor
// de Supabase, mientras que `getSession()` se fía de la cookie, que llega del
// navegador y por tanto no es de fiar para decidir accesos.
export async function getUsuarioActual() {
  const client = await createSupabaseSessionClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  return user ?? null;
}
