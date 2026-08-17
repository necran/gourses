import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioActual } from "../../lib/supabase/session-client";
import { cerrarSesion } from "../acceder/actions";
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
        De momento aquí no hay mucho: los favoritos llegan en la siguiente entrega. Lo único que
        guardamos de ti es tu correo, para poder identificarte.
      </p>

      <form action={cerrarSesion}>
        <button type="submit" className={styles.boton}>
          Cerrar sesión
        </button>
      </form>

      <p className={styles.enlaces}>
        <Link href="/buscar">Buscar cursos</Link> · <Link href="/privacidad">Privacidad</Link>
      </p>
    </main>
  );
}
