import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseSessionClient, getUsuarioActual } from "../../lib/supabase/session-client";
import { avisosActivados } from "../../lib/alertas/preferencias";
import { cerrarSesion } from "../acceder/actions";
import { BorrarCuentaForm } from "./borrar-form";
import { AvisosForm } from "./avisos-form";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Mi cuenta",
  robots: { index: false, follow: false },
};

export default async function MiCuentaPage() {
  const usuario = await getUsuarioActual();

  // Sin sesión no se muestra un error, se lleva a acceder: es lo que la
  // persona necesita hacer a continuación.
  if (!usuario) redirect("/acceder");

  const client = await createSupabaseSessionClient();
  const avisos = await avisosActivados(client);

  return (
    <main className={styles.main}>
      <h1>Mi cuenta</h1>
      <p className={styles.identidad}>
        Has entrado como <strong>{usuario.email}</strong>.
      </p>

      <p className={styles.nota}>
        Lo único que guardamos de ti es tu correo, para poder identificarte, y los cursos que
        marcas como favoritos.
      </p>

      <p className={styles.nota}>
        <Link href="/favoritos">Ver mis favoritos</Link>
      </p>

      <AvisosForm activados={avisos} />

      {/* Va antes de la zona de peligro a propósito: llevarse los datos solo
          sirve si se puede hacer *antes* de borrarlos (HU-024). */}
      <section className={styles.seccion}>
        <h2>Mis datos</h2>
        <p className={styles.nota}>
          Puedes descargarte todo lo que guardamos de ti —tu correo, tus favoritos y si
          quieres avisos— en un fichero que sirve para leerlo o llevártelo a otro sitio.
        </p>
        {/* Enlace y no botón: es una descarga, no una acción que cambie nada.
            `download` deja el nombre en manos de la cabecera de la respuesta. */}
        <a className={styles.boton} href="/mi-cuenta/exportar" download>
          Descargar mis datos
        </a>
      </section>

      <form action={cerrarSesion}>
        <button type="submit" className={styles.boton}>
          Cerrar sesión
        </button>
      </form>

      <BorrarCuentaForm correo={usuario.email ?? ""} />

      <p className={styles.enlaces}>
        <Link href="/buscar">Buscar cursos</Link> · <Link href="/privacidad">Privacidad</Link>
      </p>
    </main>
  );
}
