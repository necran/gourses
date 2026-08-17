"use client";

import { useActionState } from "react";
import { enviarEnlace, type AccederEstado } from "./actions";
import styles from "./page.module.css";

const INICIAL: AccederEstado = {};

export function AccederForm() {
  const [estado, accion, enviando] = useActionState(enviarEnlace, INICIAL);

  if (estado.enviado) {
    return (
      <p className={styles.exito} role="status">
        <strong>Revisa tu correo.</strong> Si esa dirección puede usarse para entrar, te hemos
        enviado un enlace. Caduca en poco tiempo, así que ábrelo pronto.
      </p>
    );
  }

  return (
    <form action={accion} className={styles.formulario}>
      <label htmlFor="email" className={styles.etiqueta}>
        Tu correo
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="tu@correo.com"
        className={styles.campo}
        aria-describedby={estado.error ? "error-email" : undefined}
      />

      {estado.error && (
        <p id="error-email" className={styles.error} role="alert">
          {estado.error}
        </p>
      )}

      <button type="submit" className={styles.boton} disabled={enviando}>
        {enviando ? "Enviando…" : "Enviarme el enlace"}
      </button>
    </form>
  );
}
