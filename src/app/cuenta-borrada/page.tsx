import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Cuenta borrada",
  robots: { index: false, follow: false },
};

// Página pública a propósito: cuando se llega aquí ya no hay sesión, porque la
// cuenta acaba de dejar de existir. Pedir identificarse para leer la
// confirmación sería absurdo.
export default function CuentaBorradaPage() {
  return (
    <main className={styles.main}>
      <h1>Cuenta borrada</h1>

      <p role="status" className={styles.confirmacion}>
        Hemos eliminado tu correo y tus favoritos. No queda nada tuyo en el sitio.
      </p>

      <p className={styles.nota}>
        Puedes seguir buscando y comparando cursos sin cuenta. Si algún día quieres volver a
        guardar favoritos, basta con entrar otra vez con tu correo: se creará una cuenta nueva,
        vacía.
      </p>

      <p className={styles.enlaces}>
        <Link href="/buscar">Buscar cursos</Link> · <Link href="/">Inicio</Link>
      </p>
    </main>
  );
}
