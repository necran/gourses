import type { Metadata } from "next";
import Link from "next/link";
import styles from "./legal.module.css";

// HU-064. La página 404 por defecto de Next.js no tiene `<main>`: quien navega
// con lector de pantalla no encontraba el contenido. Esta mantiene la cabecera y
// el pie del sitio y ofrece por dónde seguir.
export const metadata: Metadata = {
  title: "Página no encontrada",
  robots: { index: false, follow: true },
};

export default function NoEncontrada() {
  return (
    <main className={styles.main}>
      <h1>Esta página no existe</h1>
      <p>
        Puede que el enlace esté mal escrito o que el curso ya no esté en el catálogo de su
        plataforma.
      </p>
      <ul>
        <li>
          <Link href="/buscar">Buscar cursos</Link>
        </li>
        <li>
          <Link href="/">Volver al inicio</Link>
        </li>
      </ul>
    </main>
  );
}
