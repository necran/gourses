import type { Metadata } from "next";
import Link from "next/link";
import { TITULAR, titularCompleto } from "../../lib/legal/titular";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Aviso legal",
  description: `Datos identificativos del titular de ${TITULAR.sitio} y condiciones de uso del sitio.`,
};

export default function AvisoLegal() {
  const completo = titularCompleto();

  return (
    <main className={styles.main}>
      <p className={styles.volver}>
        <Link href="/">← Volver al inicio</Link>
      </p>

      <h1>Aviso legal</h1>
      <p className={styles.actualizado}>Última actualización: 10 de agosto de 2026</p>

      {!completo && (
        // Antes que publicar datos identificativos inventados, se advierte de
        // que faltan: la ley exige que sean los reales del titular.
        <p className={styles.aviso}>
          <strong>Pendiente de completar.</strong> Los datos identificativos del titular
          todavía no se han rellenado. Este sitio no debería operar comercialmente hasta que
          consten aquí.
        </p>
      )}

      <h2>Titular del sitio</h2>
      <ul>
        <li>
          <strong>Titular:</strong> {completo ? TITULAR.nombre : "— pendiente —"}
        </li>
        <li>
          <strong>NIF:</strong> {completo ? TITULAR.nif : "— pendiente —"}
        </li>
        <li>
          <strong>Sitio web:</strong> {TITULAR.sitio}
        </li>
        <li>
          <strong>Contacto:</strong> {TITULAR.email}
        </li>
      </ul>

      <h2>Objeto del sitio</h2>
      <p>
        {TITULAR.sitio} es un comparador de cursos online. Reúne información publicada por
        plataformas de formación de terceros y la muestra en un formato común para facilitar
        su comparación. <strong>No vendemos cursos ni impartimos formación</strong>: la
        matrícula, el pago y la prestación del servicio corresponden siempre a la plataforma
        de origen, y se rigen por sus propias condiciones.
      </p>

      <h2>Sobre la información mostrada</h2>
      <p>
        Los datos de cada curso (precio, valoración, duración, idioma, instructor) proceden
        de las interfaces públicas de las plataformas de origen y se actualizan
        periódicamente. Entre una actualización y otra pueden quedar desfasados, en especial
        los precios. <strong>El dato válido es siempre el que figure en la plataforma de
        origen en el momento de la compra.</strong>
      </p>

      <h2>Enlaces a terceros</h2>
      <p>
        Este sitio enlaza a plataformas externas y puede obtener una comisión por ello. Los
        detalles están en la página de{" "}
        <Link href="/afiliacion">información sobre afiliación</Link>. No controlamos los
        contenidos ni las políticas de esos sitios, y no respondemos de ellos.
      </p>

      <h2>Propiedad intelectual</h2>
      <p>
        Los títulos, descripciones e imágenes de los cursos pertenecen a sus respectivas
        plataformas y autores, y se muestran a efectos de identificación y comparación.
      </p>

      <h2>Legislación aplicable</h2>
      <p>
        Esta relación se rige por la legislación española. Para cualquier controversia serán
        competentes los juzgados que correspondan conforme a la normativa aplicable,
        respetando el fuero que la ley reconozca a las personas consumidoras.
      </p>
    </main>
  );
}
