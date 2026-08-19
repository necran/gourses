// Ejecuta tareas con un tope de cuántas corren a la vez (HU-023).
//
// La ingesta de Udemy pide el detalle de cada curso por separado —el listado no
// trae precio— y en serie son 0,45 s por curso: 5.000 cursos no caben en los 30
// minutos del job. Con un tope de concurrencia sí caben, sin dejar de ser
// educados con la API.
//
// El tope es deliberadamente bajo: el objetivo es acabar a tiempo, no ir lo más
// rápido posible. Que Udemy nos bloquee costaría la afiliación, que es de lo que
// vive el sitio.
export async function mapConLimite<T, R>(
  elementos: readonly T[],
  limite: number,
  tarea: (elemento: T, indice: number) => Promise<R>
): Promise<R[]> {
  if (limite < 1) throw new Error("El límite de concurrencia debe ser al menos 1.");

  const resultados = new Array<R>(elementos.length);
  let siguiente = 0;

  // Cada "obrero" va cogiendo el siguiente índice libre. Así el reparto se
  // adapta solo cuando unas tareas tardan más que otras, en vez de partir la
  // lista en trozos fijos y quedarse esperando al trozo más lento.
  async function obrero(): Promise<void> {
    while (true) {
      const indice = siguiente;
      siguiente += 1;
      if (indice >= elementos.length) return;
      resultados[indice] = await tarea(elementos[indice], indice);
    }
  }

  const obreros = Array.from({ length: Math.min(limite, elementos.length) }, obrero);
  await Promise.all(obreros);

  return resultados;
}
