import type { Metadata } from "next";
import Link from "next/link";
import { GUIAS, RUTA_GUIAS, descripcionIndiceGuias, tituloIndiceGuias } from "../../lib/courses/guias";
import { serializeStructuredData } from "../../lib/courses/course-seo";
import { OPEN_GRAPH_SITIO, migasDePan } from "../../lib/seo/seo-sitio";
import legal from "../legal.module.css";
import styles from "./page.module.css";

// Índice de guías (HU-069). Hasta ahora la única guía solo se alcanzaba desde un
// enlace de la portada y `/guias` daba 404.

export const metadata: Metadata = {
  title: tituloIndiceGuias(),
  description: descripcionIndiceGuias(),
  alternates: { canonical: RUTA_GUIAS },
  openGraph: { title: tituloIndiceGuias(), description: descripcionIndiceGuias(), ...OPEN_GRAPH_SITIO },
};

export default function IndiceDeGuias() {
  return (
    <main className={legal.main}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeStructuredData(
            migasDePan([
              { nombre: "Inicio", ruta: "/" },
              { nombre: tituloIndiceGuias(), ruta: RUTA_GUIAS },
            ])
          ),
        }}
      />
      <p className={legal.volver}>
        <Link href="/">← Inicio</Link>
      </p>

      <h1>{tituloIndiceGuias()}</h1>
      <p>
        Tenemos los catálogos de Udemy y Coursera enteros, medidos con los mismos campos. Estas
        guías cuentan lo que dicen esos datos, y se recalculan solas cada vez que se abren.
      </p>

      <ul className={styles.lista}>
        {GUIAS.map((guia) => (
          <li key={guia.ruta}>
            <h2>
              <Link href={guia.ruta}>{guia.titulo}</Link>
            </h2>
            <p>{guia.resumen}</p>
          </li>
        ))}
      </ul>

      <p>
        ¿Buscas un curso concreto? <Link href="/buscar">Busca en el catálogo</Link>.
      </p>
    </main>
  );
}
