"use client";

import { useActionState } from "react";
import { borrarCuenta, type BorradoEstado } from "./actions";
import styles from "./page.module.css";

const INICIAL: BorradoEstado = {};

export function BorrarCuentaForm({ correo }: { correo: string }) {
  const [estado, accion, enviando] = useActionState(borrarCuenta, INICIAL);

  return (
    <section className={styles.zonaPeligro}>
      <h2>Borrar mi cuenta</h2>
      <p className={styles.aviso}>
        Se elimina tu correo y tus favoritos. <strong>No tiene vuelta atrás</strong> y no
        guardamos ninguna copia: no podremos recuperarlos aunque nos lo pidas.
      </p>

      <form action={accion}>
        <label htmlFor="confirmacion" className={styles.etiqueta}>
          Para confirmar, escribe <strong>{correo}</strong>
        </label>
        <input
          id="confirmacion"
          name="confirmacion"
          type="text"
          // Que el navegador no ofrezca rellenarlo: la idea es justamente que
          // haya que escribirlo a conciencia.
          autoComplete="off"
          className={styles.campo}
          aria-describedby={estado.error ? "error-borrado" : undefined}
        />

        {estado.error && (
          <p id="error-borrado" className={styles.error} role="alert">
            {estado.error}
          </p>
        )}

        <button type="submit" className={styles.botonPeligro} disabled={enviando}>
          {enviando ? "Borrando…" : "Borrar mi cuenta para siempre"}
        </button>
      </form>
    </section>
  );
}
