import Link from "next/link";
import { TITULAR } from "../lib/legal/titular";
import styles from "./footer.module.css";

// Va en el layout raíz: las páginas legales deben ser alcanzables desde
// cualquier parte del sitio (HU-013), no solo desde la portada.
export function Footer() {
  return (
    <footer className={styles.footer}>
      <nav className={styles.enlaces} aria-label="Enlaces legales">
        <Link href="/aviso-legal">Aviso legal</Link>
        <Link href="/privacidad">Privacidad</Link>
        <Link href="/afiliacion">Cómo ganamos dinero</Link>
      </nav>
      <p className={styles.nota}>
        {TITULAR.sitio} compara cursos de plataformas externas y puede cobrar comisión por
        los enlaces. No vendemos cursos.
      </p>
    </footer>
  );
}
