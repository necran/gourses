import Link from "next/link";
import { createSupabaseSessionClient } from "../lib/supabase/session-client";
import { esFavorito } from "../lib/favorites/favorites";
import { guardarEnFavoritos, quitarDeFavoritos } from "../app/favoritos/actions";
import styles from "./boton-favorito.module.css";

interface BotonFavoritoProps {
  courseId: string;
}

// Botón de guardar/quitar de la ficha (HU-019).
//
// Es un formulario, no un botón con JavaScript: así funciona igual aunque el
// script no llegue a cargar, que es como funciona ya el resto del sitio.
export async function BotonFavorito({ courseId }: BotonFavoritoProps) {
  const client = await createSupabaseSessionClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  // Sin sesión no se enseña un botón que fallaría al pulsarlo: se explica qué
  // falta y se ofrece el paso siguiente.
  if (!user) {
    return (
      <p className={styles.invitacion}>
        <Link href="/acceder">Entra en tu cuenta</Link> para guardar este curso y volver a
        él cuando quieras.
      </p>
    );
  }

  const guardado = await esFavorito(client, courseId);

  return (
    <form action={guardado ? quitarDeFavoritos : guardarEnFavoritos}>
      <input type="hidden" name="courseId" value={courseId} />
      <button
        type="submit"
        className={guardado ? styles.botonQuitar : styles.botonGuardar}
        // Al pulsar cambia el texto del propio botón; anunciarlo evita que
        // alguien que navega con lector de pantalla se quede sin saber qué pasó.
        aria-pressed={guardado}
      >
        {guardado ? "★ Quitar de favoritos" : "☆ Guardar en favoritos"}
      </button>
    </form>
  );
}
