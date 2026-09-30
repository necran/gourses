// Detecta un almacén roto, no un curso malo (HU-073).
//
// Cada curso se guarda en su propio try/catch: un curso mal formado no debe
// tumbar el resto de la ingesta. Pero eso mismo esconde un fallo distinto —la
// base de datos entera rechazando las escrituras, por ejemplo por una
// contraseña que ha dejado de valer— porque cae en la misma bolsa de "fallos
// puntuales" y el job termina con código 0 sin haber guardado nada.
//
// Pasó de verdad: el 17 de septiembre de 2026 se cambió la contraseña de la
// base de datos de producción sin actualizar el secreto de GitHub, y durante
// dos semanas la ingesta de Udemy se ejecutó cada noche "con éxito" —el
// resumen decía `procesados: 8.500, guardados: 0`— sin que nada lo avisara.
//
// La señal que sí distingue un almacén roto de mala suerte con unos cuantos
// cursos: se procesaron cursos de verdad, y de todos ellos, ninguno se guardó.
// Un curso o dos con datos raros no llegan a cero; un almacén que rechaza toda
// escritura, sí.
export interface ResultadoDeGuardado {
  processed: number;
  saved: number;
}

export function almacenPareceRoto(resultado: ResultadoDeGuardado): boolean {
  return resultado.processed > 0 && resultado.saved === 0;
}

export function mensajeAlmacenRoto(resultado: ResultadoDeGuardado): string {
  return (
    `Se procesaron ${resultado.processed} cursos y no se guardó ninguno. ` +
    "Esto no es un curso con datos raros: es el almacén rechazando toda escritura " +
    "(revisar antes que nada la cadena de conexión a la base de datos)."
  );
}
