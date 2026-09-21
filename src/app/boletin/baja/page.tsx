import type { Metadata } from "next";
import Link from "../../../components/enlace";
import { esTokenBaja } from "../../../lib/boletin/contenido";
import legal from "../../legal.module.css";
import styles from "./page.module.css";
import { darseDeBajaDelBoletin } from "./actions";

export const metadata: Metadata = {
  title: "Darte de baja del boletín",
  robots: { index: false, follow: false },
};

interface BajaBoletinProps {
  searchParams: Promise<{ t?: string | string[]; estado?: string | string[] }>;
}

// Página del enlace de baja de cada boletín (HU-066).
//
// Abrirla no da de baja: hace falta pulsar el botón. Los filtros antivirus de
// correo abren los enlaces por su cuenta, y darían de baja a quien no lo pidió.
export default async function BajaBoletin({ searchParams }: BajaBoletinProps) {
  const parametros = await searchParams;
  const token = typeof parametros.t === "string" ? parametros.t : "";
  const estado = typeof parametros.estado === "string" ? parametros.estado : null;

  const formulario = (
    <form action={darseDeBajaDelBoletin}>
      <input type="hidden" name="t" value={token} />
      <button type="submit" className={styles.boton}>
        Darme de baja
      </button>
    </form>
  );

  return (
    <main className={legal.main}>
      <h1>Darte de baja del boletín</h1>

      {estado === "hecho" ? (
        <p role="status">
          Hecho: no te enviaremos más boletines. Los avisos de bajada de precio de tus favoritos
          no cambian; se gestionan en <Link href="/mi-cuenta">Mi cuenta</Link>.
        </p>
      ) : estado === "invalido" || !esTokenBaja(token) ? (
        <p role="alert">
          Este enlace de baja no es válido. Puedes darte de baja desde{" "}
          <Link href="/mi-cuenta">Mi cuenta</Link>, desmarcando «Boletín semanal».
        </p>
      ) : estado === "error" ? (
        <>
          <p role="alert">No hemos podido darte de baja ahora mismo. Inténtalo de nuevo.</p>
          {formulario}
        </>
      ) : (
        <>
          <p>Pulsa el botón para dejar de recibir el boletín semanal.</p>
          {formulario}
        </>
      )}
    </main>
  );
}
