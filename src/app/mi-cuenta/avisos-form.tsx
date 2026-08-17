"use client";

import { useActionState } from "react";
import { cambiarAvisos, type AvisosEstado } from "./actions";
import styles from "./page.module.css";

const INICIAL: AvisosEstado = {};

// Interruptor de los avisos de bajada de precio (HU-021).
//
// Confirma en pantalla que se ha guardado. Sin eso, pulsar «Guardar» no produce
// ningún cambio visible y no hay manera de saber si surtió efecto — ni para
// quien lo usa, ni para un test.
//
// Sin JavaScript el formulario se envía igual y la página se vuelve a pintar con
// el valor nuevo; solo se pierde el mensaje de confirmación. Nadie se queda sin
// poder dejar de recibir correo porque no le cargue un script.
export function AvisosForm({ activados }: { activados: boolean }) {
  const [estado, accion, enviando] = useActionState(cambiarAvisos, INICIAL);

  // Tras guardar manda lo que devolvió el servidor, no lo que hubiera al pintar.
  const marcado = estado.guardado ? Boolean(estado.activados) : activados;

  return (
    <section className={styles.seccion}>
      <h2>Avisos de bajada de precio</h2>
      <p className={styles.nota}>
        Te escribimos cuando baja el precio de un curso que tengas en favoritos. Un correo por
        bajada, nada más.
      </p>

      <form action={accion} className={styles.formularioAvisos}>
        <label className={styles.casilla}>
          <input type="checkbox" name="avisos" defaultChecked={marcado} key={String(marcado)} />
          <span>Quiero recibir estos avisos</span>
        </label>
        <button type="submit" className={styles.boton} disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar"}
        </button>
      </form>

      {estado.guardado && (
        <p className={styles.guardado} role="status">
          {estado.activados
            ? "Guardado. Te avisaremos cuando baje algo que tengas guardado."
            : "Guardado. No te enviaremos más avisos de precio."}
        </p>
      )}
    </section>
  );
}
