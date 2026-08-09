import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente de solo-lectura pública usado por las rutas de la web (HU-007+),
// nunca por los jobs de ingesta (esos usan Postgres directo, ver
// src/lib/ingesta/postgres-course-store.ts). La clave anon respeta la RLS
// definida en HU-004 (courses_public_read) — no bypassa nada.
export function createSupabaseServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno."
    );
  }

  return createClient(url, anonKey);
}
