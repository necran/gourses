import Link from "./enlace";
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
          className={styles.icono}
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill={guardado ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        {guardado ? "Quitar de favoritos" : "Guardar en favoritos"}
      </button>
    </form>
  );
}
