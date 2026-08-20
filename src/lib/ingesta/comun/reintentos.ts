// Reintento con espera creciente ante los límites de la API (HU-023).
//
// Mientras la ingesta iba en serie no hacía falta: una petición cada 0,45 s no
// llega a ningún límite. Con varias a la vez sí, y sin esto un 429 se llevaría
// por delante ese curso en silencio (acabaría en `failedCourses` y nadie lo
// miraría).
//
// Solo se reintenta lo que tiene sentido reintentar: un 429 o un fallo del
// servidor pasan solos, pero un 404 no va a cambiar por insistir.
//
// La espera por defecto es deliberadamente larga (1+2+4+8 = 15 s repartidos en
// cinco intentos). Con la anterior —3,5 s en total— una ejecución completa se
// dejó sin precio el 21 % de los cursos: la ventana de Udemy dura más que eso, y
// rendirse pronto solo consigue perder el precio y volver a pedirlo mañana.
const REINTENTABLES = [429, 500, 502, 503, 504];

export function esReintentable(error: unknown): boolean {
  const mensaje = error instanceof Error ? error.message : String(error);
  return REINTENTABLES.some((codigo) => mensaje.includes(String(codigo)));
}

export async function conReintentos<T>(
  tarea: () => Promise<T>,
  {
    intentos = 5,
    esperaBaseMs = 1000,
    dormir = (ms: number) => new Promise((r) => setTimeout(r, ms)),
  }: { intentos?: number; esperaBaseMs?: number; dormir?: (ms: number) => Promise<unknown> } = {}
): Promise<T> {
  let ultimoError: unknown;

  for (let intento = 0; intento < intentos; intento += 1) {
    try {
      return await tarea();
    } catch (error) {
      ultimoError = error;
      if (!esReintentable(error)) throw error;

      // Espera creciente: si la API va agobiada, insistir al mismo ritmo la
      // agobia más. El último intento no duerme, porque ya no queda otro.
      if (intento < intentos - 1) {
        await dormir(esperaBaseMs * 2 ** intento);
      }
    }
  }

  throw ultimoError;
}
