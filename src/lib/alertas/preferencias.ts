import type { SupabaseClient } from "@supabase/supabase-js";

// Preferencia de avisos por persona (HU-021).
//
// No tener fila significa "activados": así quien crea una cuenta y guarda un
// favorito recibe el aviso que espera, sin que haya que sembrar nada al darse de
// alta. La fila solo aparece cuando alguien toca el interruptor.
//
// Igual que en favoritos, quien decide de quién es cada fila es la RLS: estas
// funciones no filtran por usuario a mano.
export async function avisosActivados(client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client
    .from("alert_preferences")
    .select("price_alerts_enabled")
    .maybeSingle();

  if (error) {
    throw new Error(`Fallo al leer la preferencia de avisos: ${error.message}`);
  }

  return data === null ? true : Boolean(data.price_alerts_enabled);
}

export async function guardarPreferenciaAvisos(
  client: SupabaseClient,
  userId: string,
  activados: boolean
): Promise<void> {
  // Aquí `upsert` sí puede actualizar: la tabla tiene política de UPDATE porque
  // el interruptor se cambia de sí a no y vuelta. (En favoritos no la hay, y por
  // eso allí se usa `ignoreDuplicates`.)
  const { error } = await client
    .from("alert_preferences")
    .upsert(
      { user_id: userId, price_alerts_enabled: activados, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  if (error) {
    throw new Error(`Fallo al guardar la preferencia de avisos: ${error.message}`);
  }
}
