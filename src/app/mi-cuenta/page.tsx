import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioActual } from "../../lib/supabase/session-client";
import { cerrarSesion } from "../acceder/actions";
import { BorrarCuentaForm } from "./borrar-form";
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
