"use client";

import { useEffect, useId } from "react";
import Link from "./enlace";
import Script from "next/script";
import { useHidratado } from "../lib/use-hidratado";
import { almacenConsentimiento, useEleccionAnalitica } from "../lib/consentimiento";
import styles from "./analitica.module.css";

// Borra las cookies que pone Google Analytics (`_ga`, `_ga_<id>`) al retirar el
// consentimiento. Se intenta con el dominio exacto y con el dominio padre,
// porque Google las pone en el más amplio que puede.
function borrarCookiesDeAnalitica() {
  const nombres = document.cookie
    .split(";")
    .map((c) => c.trim().split("=")[0])
    .filter((nombre) => nombre === "_ga" || nombre.startsWith("_ga_"));
  if (nombres.length === 0) return;

  const partes = window.location.hostname.split(".");
  const dominios = ["", window.location.hostname, `.${partes.slice(-2).join(".")}`];
  for (const nombre of nombres) {
    for (const dominio of dominios) {
      const conDominio = dominio ? `; domain=${dominio}` : "";
      document.cookie = `${nombre}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${conDominio}`;
    }
  }
}

// Google Analytics solo con consentimiento previo (HU-051).
//
// No pinta nada hasta hidratar: en el servidor no se sabe qué eligió la
// persona, y así nunca se carga el script «por si acaso» antes de saberlo.
// Después: si no ha decidido, el aviso; si aceptó, el script de Google; si
// rechazó, nada. `<Script>` solo se inyecta cuando se pinta, así que no
// pintarlo es no cargarlo.
export function Analitica({ idMedicion }: { idMedicion: string }) {
  const hidratado = useHidratado();
  const eleccion = useEleccionAnalitica();
  const idTexto = useId();

  // Mientras no esté aceptado, Google Analytics queda desactivado en esta
  // página (su interruptor oficial) y sin sus cookies. Cubre el caso de retirar
  // el consentimiento después de haberlo dado, cuando el script ya se cargó.
  useEffect(() => {
    if (!hidratado) return;
    (window as unknown as Record<string, unknown>)[`ga-disable-${idMedicion}`] =
      eleccion !== "aceptado";
    if (eleccion !== "aceptado") borrarCookiesDeAnalitica();
  }, [hidratado, eleccion, idMedicion]);

  if (!hidratado || eleccion === "rechazado") return null;

  if (eleccion === "aceptado") {
    return (
      <>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${idMedicion}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${idMedicion}');`}
        </Script>
      </>
    );
  }

  // «Rechazar» y «Aceptar» con el mismo aspecto, el mismo tamaño y en la misma
  // capa, como exige la AEPD: rechazar tiene que costar lo mismo que aceptar.
  return (
    <div className={styles.aviso} role="dialog" aria-labelledby={idTexto}>
      <p id={idTexto} className={styles.texto}>
        Usamos Google Analytics para saber cuántas personas visitan Gourses y qué páginas
        se usan. Solo se activa si lo aceptas, y puedes cambiar de opinión cuando quieras
        desde «Configurar cookies», en el pie.{" "}
        <Link href="/privacidad#analitica">Más información</Link>
      </p>
      <div className={styles.botones}>
        <button
          type="button"
          className={styles.boton}
          onClick={() => almacenConsentimiento().decidir("rechazado")}
        >
          Rechazar
        </button>
        <button
          type="button"
          className={styles.boton}
          onClick={() => almacenConsentimiento().decidir("aceptado")}
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}
