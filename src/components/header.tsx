import Link from "next/link";
import { getUsuarioActual } from "../lib/supabase/session-client";
import styles from "./header.module.css";

// Cabecera del sitio (rediseño 2026-08-24). Antes no había ninguna: toda la
// navegación vivía en el pie, que solo se ve al final de la página.
//
// Igual que el pie (HU-018), decide entre "Acceder" y "Mi cuenta" según haya
// sesión. No enlaza a "Comparar" aparte: comparar exige elegir cursos primero,
// y ese paso solo existe dentro del buscador — un enlace directo llevaría a
// una página vacía pidiendo volver atrás.
export async function Header() {
  let usuario = null;
  try {
    usuario = await getUsuarioActual();
  } catch {
    // Si la autenticación no está disponible, la cabecera se sirve igual: es
    // navegación, no debe tumbar la página.
    usuario = null;
  }

  return (
    <header className={styles.header}>
      <Link href="/" className={`${styles.word} display`}>
        gourses
      </Link>
      <nav className={styles.nav} aria-label="Principal">
        <Link href="/buscar">Buscar cursos</Link>
        {usuario ? (
          <Link href="/mi-cuenta" className={styles.here}>
            Mi cuenta
          </Link>
        ) : (
          <Link href="/acceder" className={styles.primary}>
            Acceder
          </Link>
        )}
      </nav>
    </header>
  );
}
