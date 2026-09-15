"use client";

import { useActionState } from "react";
import { cambiarBoletin, type BoletinEstado } from "./actions";
import styles from "./page.module.css";

const INICIAL: BoletinEstado = {};

// Casilla del boletín semanal (HU-066). Mismo patrón que la de los avisos, pero
// desmarcada de fábrica: solo se envía a quien lo pide.
export function BoletinForm({ activo }: { activo: boolean }) {
  const [estado, accion, enviando] = useActionState(cambiarBoletin, INICIAL);
  const marcado = estado.guardado ? Boolean(estado.activo) : activo;

  return (
    <section id="boletin" className={styles.seccion}>
      <h2>Boletín semanal</h2>
      <p className={styles.nota}>
        Un correo a la semana con los cursos nuevos en español y las mayores bajadas de precio
        del catálogo. Solo si lo marcas, y puedes darte de baja desde cada correo.
      </p>

      <form action={accion} className={styles.formularioAvisos}>
        <label className={styles.casilla}>
          <input type="checkbox" name="boletin" defaultChecked={marcado} key={String(marcado)} />
          <span>Quiero recibir el boletín semanal</span>
        </label>
        <button type="submit" className={styles.boton} disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar preferencia"}
        </button>
      </form>

      {estado.guardado && (
        <p className={styles.guardado} role="status">
          {estado.activo
            ? "Guardado. Te enviaremos el boletín cada semana."
            : "Guardado. No te enviaremos el boletín."}
        </p>
      )}
    </section>
  );
}
