"use client";

import { useActionState } from "react";
import { cambiarCorreo } from "./actions";
import type { ResultadoCambioCorreo } from "../../lib/auth/resultado-cambio-correo";
import styles from "./page.module.css";

const INICIAL: ResultadoCambioCorreo = {};

// Formulario de cambio de correo (HU-037).
//
// La respuesta de éxito es **la misma tanto si la dirección ya tenía cuenta
// como si no**: comprobado contra Supabase, pedir el cambio a un correo ajeno
// devuelve el error en el momento (`email_exists`), así que hay que taparlo a
// propósito o el formulario serviría para averiguar quién está registrado.
// Esa decisión vive en `resultadoCambioCorreo`, no aquí — este componente solo
// pinta lo que le llega.
//
// Sin JavaScript el formulario se envía igual; solo se pierde el «Enviando…»
// del botón.
export function CambiarCorreoForm() {
  const [estado, accion, enviando] = useActionState(cambiarCorreo, INICIAL);

  if (estado.enviado) {
    return (
      <p className={styles.guardado} role="status">
        Revisa tu correo. Si esa dirección puede usarse, te hemos enviado un enlace de
        confirmación —y, si hace falta, otro a tu correo actual—. El cambio no se aplica hasta
        que confirmes lo que llegue.
      </p>
    );
  }

  return (
    <form action={accion} className={styles.formularioCorreo}>
      <label htmlFor="correo-nuevo" className={styles.etiquetaCorreo}>
        Correo nuevo
      </label>
      <input
        id="correo-nuevo"
        name="correo"
        type="email"
        autoComplete="email"
        required
        placeholder="tu-correo-nuevo@ejemplo.com"
        className={styles.campoCorreo}
        aria-describedby={estado.error ? "error-cambio-correo" : undefined}
      />

      {estado.error && (
        <p id="error-cambio-correo" className={styles.errorCorreo} role="alert">
          {estado.error}
        </p>
      )}

      <button type="submit" className={styles.boton} disabled={enviando}>
        {enviando ? "Enviando…" : "Cambiar correo"}
      </button>
    </form>
  );
}
