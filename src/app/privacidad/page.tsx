import type { Metadata } from "next";
import Link from "next/link";
import { TITULAR } from "../../lib/legal/titular";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: `Qué datos trata ${TITULAR.sitio} y cuáles no: sin cuentas, sin cookies propias y sin analítica.`,
};

export default function Privacidad() {
  return (
    <main className={styles.main}>
      <p className={styles.volver}>
        <Link href="/">← Volver al inicio</Link>
      </p>

      <h1>Política de privacidad</h1>
      <p className={styles.actualizado}>Última actualización: 10 de agosto de 2026</p>

      <p>
        Esta política describe lo que este sitio hace <strong>hoy</strong>, no lo que suele
        poner una plantilla. Si en el futuro añadimos cuentas de usuario, analítica o
        cookies, se actualizará antes de ponerlas en marcha.
      </p>

      <h2>Lo que no hacemos</h2>
      <ul>
        <li>No usamos cookies propias.</li>
        <li>No usamos herramientas de analítica ni rastreadores publicitarios.</li>
        <li>No hay registro ni cuentas de usuario, así que no pedimos nombre ni correo.</li>
        <li>No vendemos ni cedemos datos personales a nadie con fines comerciales.</li>
      </ul>

      <h2>Lo que sí ocurre</h2>

      <h3>Imágenes servidas por las plataformas de origen</h3>
      <p>
        Las imágenes de los cursos se cargan <strong>directamente desde los servidores de
        Udemy y Coursera</strong>. Eso significa que, al ver una página con resultados, tu
        navegador se conecta a esos servidores y les comunica tu dirección IP, tu navegador y
        la página desde la que se solicita la imagen, igual que si visitaras su web. No
        controlamos qué hacen con esa información; se rige por sus respectivas políticas de
        privacidad.
      </p>

      <h3>Registros del servidor</h3>
      <p>
        Nuestro proveedor de alojamiento registra las peticiones recibidas, incluida la
        dirección IP, con la finalidad de prestar el servicio, garantizar su seguridad y
        diagnosticar incidencias. La base jurídica es el interés legítimo en mantener el
        sitio operativo y seguro.
      </p>

      <h3>Búsquedas</h3>
      <p>
        Lo que escribes en el buscador viaja en la dirección de la página para poder mostrar
        los resultados y compartir el enlace. No lo asociamos a ninguna persona ni lo
        guardamos en nuestra base de datos.
      </p>

      <h3>Al salir hacia una plataforma</h3>
      <p>
        Cuando pulsas el enlace de un curso abandonas este sitio. A partir de ahí se aplican
        la política de privacidad y las cookies de la plataforma de destino, incluidas las
        que puedan usarse para atribuir la venta a este sitio (ver{" "}
        <Link href="/afiliacion">información sobre afiliación</Link>).
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes ejercer los derechos de acceso, rectificación, supresión, oposición,
        limitación y portabilidad escribiendo a <strong>{TITULAR.email}</strong>. Ten en
        cuenta que, al no haber cuentas de usuario, en la práctica no conservamos información
        que permita identificarte más allá de los registros técnicos mencionados. También
        puedes reclamar ante la Agencia Española de Protección de Datos.
      </p>
    </main>
  );
}
