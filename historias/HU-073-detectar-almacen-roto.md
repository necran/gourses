# HU-073 — Que un job de ingesta no pueda "tener éxito" sin guardar nada

## Contexto

Fase 6, fiabilidad de la ingesta (2026-09-30). El 17 de septiembre se le pidió al usuario
resetear la contraseña de la base de datos de producción, dos veces, para poder ejecutar un
script de mantenimiento (`clasificar-temas.mjs`) desde local. El secreto `PROD_DATABASE_URL`
de GitHub Actions **nunca se actualizó** con la contraseña nueva.

Resultado, durante 13 días:

- **Ingesta de catálogo (Udemy, español)**, **Boletín semanal** y **Avisos de bajada de
  precio**: fallaban en el acto (`password authentication failed`), porque abren una sola
  conexión al principio y mueren si falla.
- **Ingesta de catálogo** (Udemy en inglés): **terminaba "con éxito"**, cada noche, durante
  67 minutos, habiendo guardado **cero cursos**. Comprobado en la base real: ningún curso
  tiene `updated_at` posterior al 16 de septiembre.

La causa: `runUdemyIngestJob` guarda cada curso en su propio `try/catch`, a propósito, para
que uno mal formado no tumbe el resto de la ingesta (regla del proyecto). Pero un fallo de la
base de datos entera cae en la misma bolsa que un curso con datos raros, y el job resuelve
normalmente con `saved: 0` sin que nada lo trate como un fallo.

Reproducido en local, con una contraseña deliberadamente rota:

```
Ámbitos recorridos: 1, procesados: 50, guardados: 0
Cursos fallidos (50): [{ error: 'password authentication failed for user "postgres"' }, …]
```

El job terminaba con código de salida 0. Nadie se enteró hasta que se preguntó
explícitamente "¿por qué fallan los jobs?" — 13 días después.

## Como responsable del sitio quiero que la ingesta falle de forma ruidosa cuando la base de datos rechaza todo, para enterarme el mismo día y no dos semanas después

## Criterios de aceptación

- **Given** una ejecución que procesó cursos pero no guardó ninguno **When** termina
  **Then** el script sale con código distinto de cero y un mensaje que señala primero la
  conexión a la base de datos, no los datos de los cursos
- **Given** una ejecución que no procesó ningún curso (ámbito vacío, catálogo sin novedades)
  **When** termina **Then** no se marca como fallo: no hay nada que hubiera podido guardar
- **Given** una ejecución donde solo algunos cursos fallan por tener datos raros, y al menos
  uno se guarda **When** termina **Then** sigue sin ser un fallo del job: es justo el caso que
  la ingesta tiene que seguir tolerando
- **Given** el mismo fallo real de contraseña reproducido en local **When** se ejecuta el job
  **Then** el código de salida es 1 (comprobado, no solo con datos de prueba)

## Fuera de alcance

- **Actualizar el secreto `PROD_DATABASE_URL` en GitHub**: acción del usuario, ver más abajo.
  No pasa por aquí ni por ningún script.
- **Alertar por otro canal** (correo, Slack) cuando un job falla: GitHub ya notifica al
  propietario del repositorio los workflows en rojo; con este cambio, el de Udemy empezará a
  estar en rojo cuando corresponda, que es lo que faltaba.
- **Aplicar el mismo umbral a los jobs de resúmenes o al boletín**: ya fallan alto y claro
  (conexión única al principio); el hueco solo existía en la ingesta, por el patrón de
  guardado curso a curso.

## Diseño

- `src/lib/ingesta/comun/almacen-roto.ts`: `almacenPareceRoto({processed, saved})` — pura,
  sin tocar nada de red ni de base de datos. La señal es «se procesó algo y no se guardó
  nada», que distingue un almacén roto de mala suerte con unos pocos cursos.
- Ambos entrypoints (`scripts/ingest-udemy.mjs`, `scripts/ingest-coursera.mjs`) la llaman
  tras el resumen del job y ponen `process.exitCode = 1` con un mensaje que apunta primero a
  la cadena de conexión.
- Coursera se incluye por coherencia y por si la base se rompe a media ejecución (su `Client`
  único solo protege el arranque), aunque el hueco real medido era el de Udemy.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: `almacenPareceRoto` con los cuatro casos (nada procesado, todo rechazado,
      parcialmente rechazado con al menos uno guardado, todo guardado)
- [x] Comprobado en local, contra producción, con una contraseña rota de verdad: mismo
      mensaje de error que en GitHub Actions (`password authentication failed`) y código de
      salida 1
- [x] Solo lógica pura y dos scripts de entrada; no aplica e2e
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada` (2026-09-30), en la rama `HU-073-detectar-almacen-roto`, sin fusionar. El cambio no
toca ninguna ruta de la web, así que no hace falta gastar un despliegue solo por esto: se
fusiona y publica en el próximo lote.

### Resultado de los tests

- Unitarios (`npm test`): 851 pasan (5 nuevos).
- Integración (`npm run test:integration`): 162 pasan (nada tocaba este código).
- No se ha lanzado la suite e2e completa: este cambio no afecta a ninguna página ni ruta, solo
  a dos scripts de ingesta que ya no tienen tests e2e (no los tenían antes tampoco).

### Lo que sigue pendiente, y es del usuario

1. **Actualizar el secreto `PROD_DATABASE_URL` en GitHub** con el valor que ya funciona en
   `.env.local` — comprobado con tres ingestas reales contra producción (Coursera 100
   cursos, Udemy inglés 50, Udemy español 50) durante este diagnóstico. No hace falta
   resetear la contraseña otra vez.
2. **`GEMINI_API_KEY` sigue sin crearse.** El paso "Generar resúmenes" del workflow de
   resúmenes aparece como `skipped`, no como fallo: la petición anterior de crear los
   secretos no llegó a completarse.
3. Tras corregir el secreto, la próxima ejecución de `ingesta.yml` debería volver a guardar
   cursos de verdad; si algo sigue mal, ahora el job lo dirá en rojo el mismo día.

### Revisión de seguridad

Sin hallazgos. `almacenPareceRoto` no recibe ni expone ninguna credencial, solo dos números.
Los mensajes de error que se imprimen a los logs de GitHub Actions ya se imprimían antes
igual (`Cursos fallidos`, con el mensaje de la excepción); no se ha añadido ninguna
credencial ni dato personal a la salida.