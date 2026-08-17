import Link from "next/link";
import { TITULAR } from "../lib/legal/titular";
import { getUsuarioActual } from "../lib/supabase/session-client";
import styles from "./footer.module.css";

// Va en el layout raíz: las páginas legales deben ser alcanzables desde
// cualquier parte del sitio (HU-013), no solo desde la portada.
export async function Footer() {
  // Un criterio de HU-018: desde cualquier página se sabe si hay sesión y se
  // tiene a mano entrar o ir a la cuenta.
  let usuario = null;
  try {
    usuario = await getUsuarioActual();
  } catch {
    // Si la autenticación no está disponible, el pie se sirve igual: es
    // navegación, no debe tumbar la página.
    usuario = null;
  }

  return (
    <footer className={styles.footer}>
      <nav className={styles.enlaces} aria-label="Enlaces legales">
        <Link href="/aviso-legal">Aviso legal</Link>
        <Link href="/privacidad">Privacidad</Link>
        <Link href="/afiliacion">Cómo ganamos dinero</Link>
        {usuario ? (
          <Link href="/mi-cuenta">Mi cuenta</Link>
        ) : (
          <Link href="/acceder">Acceder</Link>
        )}
      </nav>
      <p className={styles.nota}>
        {TITULAR.sitio} compara cursos de plataformas externas y puede cobrar comisión por
        los enlaces. No vendemos cursos.
      </p>
    </footer>
  );
}
