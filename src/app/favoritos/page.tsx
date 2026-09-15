import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseSessionClient } from "../../lib/supabase/session-client";
import { listarFavoritos } from "../../lib/favorites/favorites";
import { formatDuration } from "../../lib/courses/duration";
import { nombrePlataforma } from "../../lib/courses/presentacion";
import { DIMENSIONES_MINIATURA, cargaDeMiniatura } from "../../lib/imagenes";
import { hrefCompararFavoritos } from "../../lib/courses/compare";
import { BotonCesta } from "../../components/boton-cesta";
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
  // HU-041: un enlace normal, sin tocar la cesta, para que funcione igual sin
  // JavaScript. Solo existe si caben todos (ver hrefCompararFavoritos).
  const enlaceComparar = hrefCompararFavoritos(favoritos.map((curso) => curso.id));

  return (
    <main className={styles.main}>
      <h1>Mis favoritos</h1>

      {enlaceComparar && (
        <p className={styles.compararTodos}>
          <Link href={enlaceComparar} className={styles.botonCompararTodos}>
            Comparar mis favoritos
          </Link>
        </p>
      )}

      {favoritos.length === 0 ? (
        // Una lista vacía no es un error, es un punto de partida: se dice qué
        // hacer en lugar de dejar un hueco.
        <p role="status" className={styles.vacio}>
          Todavía no has guardado ningún curso. Busca uno que te interese y pulsa
          «Guardar en favoritos» en su ficha. <Link href="/buscar">Buscar cursos</Link>
        </p>
      ) : (
        <ul className={styles.lista}>
          {favoritos.map((curso, posicion) => (
            <li key={curso.id} className={styles.tarjeta}>
              {curso.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={curso.imageUrl}
                  alt=""
                  className={styles.imagen}
                  {...DIMENSIONES_MINIATURA}
                  loading={cargaDeMiniatura(posicion)}
                  decoding="async"
                />
              )}
              <div className={styles.cuerpo}>
                <h2>
                  <Link href={`/curso/${curso.id}`}>{curso.title}</Link>
                </h2>
                <p className={styles.meta}>
                  <span>{nombrePlataforma(curso.source)}</span>
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

              <div className={styles.acciones}>
                <BotonCesta courseId={curso.id} title={curso.title} compacto />
                <form action={quitarDeFavoritos}>
                  <input type="hidden" name="courseId" value={curso.id} />
                  <button type="submit" className={styles.quitar}>
                    Quitar
                  </button>
                </form>
              </div>
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
