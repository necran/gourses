import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseSessionClient } from "../../lib/supabase/session-client";
import { listarFavoritos } from "../../lib/favorites/favorites";
import { formatDuration } from "../../lib/courses/duration";
import { quitarDeFavoritos } from "./actions";
import styles from "./page.module.css";

// Lista privada: no debe acabar en un buscador.
export const metadata: Metadata = {
  title: "Mis favoritos",
  robots: { index: false, follow: false },
};

export default async function FavoritosPage() {
  const client = await createSupabaseSessionClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) redirect("/acceder");

  const favoritos = await listarFavoritos(client);

  return (
    <main className={styles.main}>
      <h1>Mis favoritos</h1>

      {favoritos.length === 0 ? (
        // Una lista vacía no es un error, es un punto de partida: se dice qué
        // hacer en lugar de dejar un hueco.
        <p role="status" className={styles.vacio}>
          Todavía no has guardado ningún curso. Busca uno que te interese y pulsa
          «Guardar en favoritos» en su ficha. <Link href="/buscar">Buscar cursos</Link>
        </p>
      ) : (
        <ul className={styles.lista}>
          {favoritos.map((curso) => (
            <li key={curso.id} className={styles.tarjeta}>
              {curso.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={curso.imageUrl} alt="" className={styles.imagen} />
              )}
              <div className={styles.cuerpo}>
                <h2>
                  <Link href={`/curso/${curso.id}`}>{curso.title}</Link>
                </h2>
                <p className={styles.meta}>
                  <span>{curso.source}</span>
                  {curso.priceAmount !== null && (
                    <span>
                      {" "}
                      · {curso.priceAmount} {curso.priceCurrency}
                    </span>
                  )}
                  {curso.rating !== null && <span> · ⭐ {curso.rating}</span>}
                  {formatDuration(curso.duration) && (
                    <span> · ⏱ {formatDuration(curso.duration)}</span>
                  )}
                </p>
              </div>

              <form action={quitarDeFavoritos}>
                <input type="hidden" name="courseId" value={curso.id} />
                <button type="submit" className={styles.quitar}>
                  Quitar
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <p className={styles.enlaces}>
        <Link href="/buscar">Buscar más cursos</Link> ·{" "}
        <Link href="/mi-cuenta">Mi cuenta</Link>
      </p>
    </main>
  );
}
