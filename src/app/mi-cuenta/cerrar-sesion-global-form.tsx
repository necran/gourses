"use client";

import { useActionState } from "react";
import { cerrarSesionGlobal, type CierreGlobalEstado } from "./actions";
import styles from "./page.module.css";

const INICIAL: CierreGlobalEstado = {};

// Botón de «Cerrar sesión en todos los dispositivos» (HU-038).
//
// Aparte de `<form action={cerrarSesion}>` porque, a diferencia de ese, este
// puede fallar de una forma que hay que contar: si Supabase no revoca los
// tokens, mejor decirlo que dejar creer que el acceso se ha cortado en todas
// partes cuando puede que no. `useActionState` es lo que permite mostrar ese
// error sin perder la fila donde ya se lee el estado del envío.
//
// Sin JavaScript el formulario se envía igual: solo se pierde el «Cerrando…»
// del botón, no la posibilidad de usarlo.
export function CerrarSesionGlobalForm() {
  const [estado, accion, enviando] = useActionState(cerrarSesionGlobal, INICIAL);

  return (
    <form action={accion}>
      <button type="submit" className={styles.botonTexto} disabled={enviando}>
        {enviando ? "Cerrando…" : "Cerrar sesión en todos los dispositivos"}
      </button>
      {estado.error && (
        <p className={styles.error} role="alert">
          {estado.error}
        </p>
      )}
    </form>
  );
}
