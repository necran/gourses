import type { SupabaseClient } from "@supabase/supabase-js";

// Preferencia del boletín semanal (HU-066).
//
// Sin fila, no está apuntada: al revés que los avisos de precio, porque el
// boletín es comunicación comercial y solo se envía a quien lo pide. Como en los
// avisos, de quién es cada fila lo decide la RLS, no un filtro aquí.
export async function boletinActivo(client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client.from("boletin_suscripciones").select("activo").maybeSingle();

  if (error) {
    throw new Error(`Fallo al leer la preferencia del boletín: ${error.message}`);
  }

  return data?.activo === true;
}

export async function guardarPreferenciaBoletin(
  client: SupabaseClient,
  userId: string,
  activo: boolean
): Promise<void> {
  const ahora = new Date().toISOString();
  const { error } = await client.from("boletin_suscripciones").upsert(
    {
      user_id: userId,
      activo,
      updated_at: ahora,
      // Al apuntarse se guarda cuándo: es la prueba del consentimiento. Al darse
      // de baja no se borra, para saber hasta cuándo lo tuvo.
      ...(activo ? { consentido_en: ahora } : {}),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw new Error(`Fallo al guardar la preferencia del boletín: ${error.message}`);
  }
}
