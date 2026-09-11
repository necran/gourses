import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseSessionClient, getUsuarioActual } from "../../lib/supabase/session-client";
import { contarFavoritos } from "../../lib/favorites/favorites";
import { avisosActivados } from "../../lib/alertas/preferencias";
import { resumenDeCuenta } from "../../lib/cuenta/resumen";
import { cerrarSesion } from "../acceder/actions";
import { BorrarCuentaForm } from "./borrar-form";
import { AvisosForm } from "./avisos-form";
import { CerrarSesionGlobalForm } from "./cerrar-sesion-global-form";
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

  // Las dos lecturas son informativas: si una falla, su línea del resumen lo
  // dice y el resto de la página —cerrar sesión, exportar, borrar— sigue
  // disponible. `null` distingue «no se pudo cargar» de un valor real.
  let numFavoritos: number | null = null;
  try {
    numFavoritos = await contarFavoritos(client);
  } catch {
    numFavoritos = null;
  }

  let avisos: boolean | null = null;
  try {
    avisos = await avisosActivados(client);
  } catch {
    avisos = null;
  }

  const resumen = resumenDeCuenta({
    correo: usuario.email,
    altaEn: usuario.created_at,
    ultimoAccesoEn: usuario.last_sign_in_at,
    numeroDeFavoritos: numFavoritos,
    avisosDeBajadaDePrecio: avisos,
  });

  return (
    <main className={styles.main}>
      <h1>Mi cuenta</h1>
      <p className={styles.identidad}>
        Has entrado como <strong>{usuario.email}</strong>.
      </p>

      {/* Derecho de acceso (RGPD art. 15): qué se guarda, para qué y cuánto
          tiempo, en la propia cuenta y no solo escribiendo a un buzón (HU-036). */}
      <section className={styles.seccion}>
        <h2>Qué guardamos sobre ti</h2>
        <dl className={styles.resumenDatos}>
          {resumen.lineas.map((linea) => (
            <div key={linea.etiqueta} className={styles.resumenFila}>
              <dt>{linea.etiqueta}</dt>
              <dd>{linea.valor}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.nota}>{resumen.finalidadYConservacion}</p>
        <p className={styles.nota}>
          Puedes <a href="#mis-datos">descargarlo todo</a> o{" "}
          <a href="#borrar-cuenta">borrar la cuenta</a> cuando quieras.
        </p>
      </section>

      <section className={styles.seccion}>
        <h2>Mis favoritos</h2>
        {numFavoritos === null ? (
          <p className={styles.nota}>
            No hemos podido cargar tus favoritos ahora mismo.{" "}
            <Link href="/favoritos">Abrir la lista</Link>
          </p>
        ) : numFavoritos === 0 ? (
          <p className={styles.nota}>
            Aún no has guardado ningún curso. Cuando encuentres uno que te interese, pulsa
            «Guardar en favoritos» en su ficha. <Link href="/buscar">Buscar cursos</Link>
          </p>
        ) : (
          <>
            <p className={styles.nota}>
              Tienes{" "}
              <strong>
                {numFavoritos} {numFavoritos === 1 ? "curso guardado" : "cursos guardados"}
              </strong>
              .
            </p>
            <a className={styles.boton} href="/favoritos">
              Ver mis favoritos
            </a>
          </>
        )}
      </section>

      {/* `avisos ?? true`: si la lectura falló, el interruptor cae en el valor
          por defecto documentado («sin fila = activados»); el resumen de arriba
          ya avisa de que no se pudo leer. */}
      <AvisosForm activados={avisos ?? true} />

      {/* Va antes de la zona de peligro a propósito: llevarse los datos solo
          sirve si se puede hacer *antes* de borrarlos (HU-024). */}
      <section id="mis-datos" className={styles.seccion}>
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

      <div className={styles.cierreSesion}>
        <form action={cerrarSesion}>
          <button type="submit" className={styles.boton}>
            Cerrar sesión
          </button>
        </form>
        <CerrarSesionGlobalForm />
      </div>
      {/* La diferencia entre las dos, para que nadie pulse la global pensando
          que es la de siempre, ni al revés cuando de verdad hace falta
          (HU-038). */}
      <p className={styles.nota}>
        «Cerrar sesión» solo afecta a este navegador. Si entraste desde otro
        dispositivo, o crees que alguien ha podido acceder a tu correo, usa «Cerrar
        sesión en todos los dispositivos»: cierra todas tus sesiones abiertas, estén
        donde estén. Los demás dispositivos dejan de estar identificados en cuanto
        vuelven a necesitar renovarla, no al instante.
      </p>

      <BorrarCuentaForm correo={usuario.email ?? ""} />

      <p className={styles.enlaces}>
        <Link href="/buscar">Buscar cursos</Link> · <Link href="/privacidad">Privacidad</Link>
      </p>
    </main>
  );
}
