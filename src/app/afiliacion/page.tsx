import type { Metadata } from "next";
import Link from "next/link";
import { TITULAR } from "../../lib/legal/titular";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Cómo ganamos dinero",
  description:
    "Este sitio puede cobrar comisión por los enlaces a las plataformas. Explicamos cómo funciona y qué no cambia por ello.",
};

export default function Afiliacion() {
  return (
    <main className={styles.main}>
      <p className={styles.volver}>
        <Link href="/">← Volver al inicio</Link>
      </p>

      <h1>Cómo ganamos dinero</h1>
      <p className={styles.actualizado}>Última actualización: 10 de agosto de 2026</p>

      <p className={styles.aviso}>
        <strong>En corto:</strong> cuando pulsas el enlace de un curso y acabas
        matriculándote, este sitio puede llevarse una comisión de la plataforma.{" "}
        <strong>A ti no te cuesta ni un céntimo más</strong>, y no cambiamos el orden de los
        resultados para favorecer a quien paga más.
      </p>

      <h2>Qué es un enlace de afiliado</h2>
      <p>
        Algunas plataformas de formación pagan una comisión a quien les envía una persona
        que termina comprando. Es su forma de hacer publicidad. Para saber que la visita
        viene de aquí, el enlace lleva un identificador y la plataforma registra el paso,
        normalmente con una cookie propia.
      </p>

      <h2>Qué no cambia por ello</h2>
      <ul>
        <li>
          <strong>El precio.</strong> Pagas exactamente lo mismo que si llegaras a la
          plataforma por tu cuenta. La comisión sale del margen de la plataforma, no de tu
          bolsillo.
        </li>
        <li>
          <strong>El orden de los resultados.</strong> Los cursos se ordenan por sus datos
          —valoración y criterios de búsqueda— y se alternan entre plataformas para que
          ninguna quede oculta. No se cobra por aparecer antes.
        </li>
        <li>
          <strong>Qué cursos se incluyen.</strong> El catálogo se construye desde las
          interfaces públicas de cada plataforma, sin excluir cursos por no dar comisión.
        </li>
      </ul>

      <h2>Con qué plataformas trabajamos</h2>
      <p>
        Actualmente el catálogo reúne cursos de <strong>Udemy</strong> y{" "}
        <strong>Coursera</strong>. Cuando un enlace sea de afiliado, estará indicado en la
        propia ficha del curso.
      </p>

      <h2>Por qué te lo contamos</h2>
      <p>
        Porque es tu derecho saberlo antes de fiarte de una recomendación, y porque la
        normativa de publicidad de la Unión Europea y de Estados Unidos exige declararlo de
        forma clara. Si algo de esta página no se entiende, escríbenos a{" "}
        <strong>{TITULAR.email}</strong>.
      </p>

      <p>
        Ver también el <Link href="/aviso-legal">aviso legal</Link> y la{" "}
        <Link href="/privacidad">política de privacidad</Link>.
      </p>
    </main>
  );
}
