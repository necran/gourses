import type { Metadata } from "next";
import Link from "next/link";
import { TITULAR } from "../../lib/legal/titular";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: `Qué datos trata ${TITULAR.sitio} y cuáles no: sin analítica, sin rastreadores y sin ceder datos a nadie.`,
};

export default function Privacidad() {
  return (
    <main className={styles.main}>
      <p className={styles.volver}>
        <Link href="/">← Volver al inicio</Link>
      </p>

      <h1>Política de privacidad</h1>
      <p className={styles.actualizado}>Última actualización: 11 de agosto de 2026</p>

      <p>
        Esta política describe lo que este sitio hace <strong>hoy</strong>, no lo que suele
        poner una plantilla. Si añadimos algo que trate datos de otra forma, se actualiza antes
        de ponerlo en marcha, como se hizo al incorporar las cuentas de usuario.
      </p>

      <h2>Lo que no hacemos</h2>
      <ul>
        <li>No usamos herramientas de analítica ni rastreadores publicitarios.</li>
        <li>No usamos cookies de publicidad ni de seguimiento entre sitios.</li>
        <li>No pedimos nombre, apellidos, teléfono ni datos de pago.</li>
        <li>No vendemos ni cedemos datos personales a nadie con fines comerciales.</li>
        <li>No usamos tu correo para enviarte publicidad.</li>
      </ul>

      <h2>Si creas una cuenta</h2>
      <p>
        Tener cuenta es opcional: puedes buscar y comparar cursos sin identificarte. Si decides
        crearla, esto es exactamente lo que ocurre.
      </p>

      <h3>Qué guardamos</h3>
      <p>
        <strong>Tu dirección de correo, y poco más.</strong> No usamos contraseñas: para entrar te
        enviamos un enlace de un solo uso, así que no hay ninguna contraseña tuya almacenada.
        Junto al correo se guardan las fechas de creación y último acceso de la cuenta, que
        genera automáticamente el sistema de autenticación.
      </p>
      <p>
        Si marcas cursos como favoritos, guardamos <strong>qué cursos son y cuándo los
        guardaste</strong>, asociados a tu cuenta. Esa lista es privada: nadie más puede verla,
        ni siquiera otras personas registradas. La base de datos lo impide por sí misma, no
        solo la pantalla que te la muestra. Puedes quitar cualquier curso cuando quieras, y al
        hacerlo la fila se borra.
      </p>

      <h3>Para qué y con qué base jurídica</h3>
      <p>
        Únicamente para identificarte y poder asociarte lo que guardes en el sitio. La base
        jurídica es la ejecución del servicio que tú mismo solicitas al crear la cuenta
        (artículo 6.1.b del RGPD).
      </p>

      <h3>Cookies de sesión</h3>
      <p>
        Al entrar se instalan cookies necesarias para mantener la sesión iniciada. Son
        imprescindibles para que el servicio funcione —sin ellas tendrías que identificarte en
        cada página— y no se usan para seguirte ni para publicidad. Si cierras sesión, se
        eliminan.
      </p>

      <h3>Quién más interviene</h3>
      <ul>
        <li>
          <strong>Supabase</strong> gestiona la autenticación y la base de datos. Los datos se
          alojan en la Unión Europea (Irlanda).
        </li>
        <li>
          <strong>Resend</strong> envía el correo con tu enlace de acceso.
        </li>
      </ul>

      <h3>Cuánto tiempo, y cómo borrarlo</h3>
      <p>
        Mientras tengas la cuenta. Puedes borrarla tú mismo cuando quieras desde{" "}
        <Link href="/mi-cuenta">Mi cuenta</Link>: se elimina tu correo y tus favoritos, sin
        vuelta atrás y sin que quede ninguna copia. No hace falta que nos escribas ni que
        esperes a que alguien te atienda.
      </p>

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
        limitación y portabilidad escribiendo a <strong>{TITULAR.email}</strong>. Si no tienes
        cuenta, en la práctica no conservamos información que permita identificarte más allá de
        los registros técnicos mencionados. También puedes reclamar ante la Agencia Española de
        Protección de Datos.
      </p>
    </main>
  );
}
