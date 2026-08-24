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
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill={guardado ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3l2.9 6.26L22 10.27l-5 4.87 1.18 6.88L12 18.77l-6.18 3.25L7 15.14 2 10.27l7.1-1.01L12 3z" />
        </svg>
        {guardado ? "Quitar de favoritos" : "Guardar en favoritos"}
      </button>
    </form>
  );
}
