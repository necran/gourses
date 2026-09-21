import type { Metadata } from "next";
import Link from "../../components/enlace";
import { redirect } from "next/navigation";
import { getUsuarioActual } from "../../lib/supabase/session-client";
import { AccederForm } from "./form";
import { avisoAcceso } from "../../lib/auth/aviso-acceso";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Acceder",
  description: "Entra en tu cuenta de Gourses con un enlace enviado a tu correo, sin contraseñas.",
  robots: { index: false, follow: false },
};

export default async function AccederPage({
  searchParams,
}: {
  searchParams: Promise<{ [clave: string]: string | string[] | undefined }>;
}) {
  // Quien ya ha entrado no tiene nada que hacer aquí.
  if (await getUsuarioActual()) redirect("/mi-cuenta");

  // Lo manda `acceder/callback` cuando el enlace del correo no sirve.
  const aviso = avisoAcceso((await searchParams).error);

  return (
    <main className={styles.main}>
      <p className={styles.volver}>
        <Link href="/">← Volver al inicio</Link>
      </p>

      <h1>Entrar en tu cuenta</h1>
      <p className={styles.intro}>
        Escribe tu correo y te enviamos un enlace para entrar. <strong>No hay contraseñas</strong>:
        nada que recordar y nada que se pueda filtrar.
      </p>

      {aviso && (
        <p className={styles.avisoEnlace} role="alert">
          {aviso}
        </p>
      )}

      <AccederForm />

      <p className={styles.aviso}>
        Al entrar aceptas nuestro <Link href="/aviso-legal">aviso legal</Link> y el tratamiento de
        tu correo descrito en la <Link href="/privacidad">política de privacidad</Link>.
      </p>
    </main>
  );
}
