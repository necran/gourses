# HU-015 — Ingesta programada en producción

## Contexto

Fase 6, cierre del despliegue. El catálogo de producción se cargó **una sola vez, a mano**, ejecutando los jobs desde el portátil contra la base de la nube. Eso deja dos problemas reales:

1. **Los datos se congelan.** Si Udemy cambia precios, la web sigue mostrando los de la carga inicial. Y sin precios que cambien, el histórico de `HU-004` no registra nada y las alertas de bajada de precio (Fase 4) no tendrían de qué avisar.
2. **Supabase pausa el proyecto gratuito tras un periodo de inactividad.** Sin escrituras periódicas, un día la web deja de cargar datos sin que nadie haya tocado nada.

Decisión ya razonada en `docs/analisis-y-estrategia.md`: la ingesta va en **GitHub Actions**, no en el hosting. El job de Udemy encadena más de 300 peticiones y tarda minutos; las funciones serverless de Netlify cortan a los 10–30 segundos y lo matarían a medias. Actions permite hasta 6 horas y el repositorio ya está ahí.

## Como titular del proyecto quiero que el catálogo se actualice solo cada día para que los precios estén al día sin que yo tenga que ejecutar nada

## Criterios de aceptación

- **Given** el repositorio en GitHub **When** llega la hora programada **Then** se ejecuta la ingesta de ambas fuentes contra la base de producción, sin intervención manual.
- **Given** una ejecución programada **When** una fuente falla **Then** la otra se ingiere igualmente y el fallo queda registrado, en vez de perderse la actualización entera.
- **Given** un cambio de precio en una plataforma **When** se ejecuta la ingesta **Then** el precio nuevo queda guardado y se añade una fila al histórico, igual que en local.
- **Given** las credenciales de las APIs **When** se ejecuta el flujo **Then** se leen de los secretos del repositorio y nunca aparecen en los registros de ejecución.
- **Given** que quiero comprobarlo sin esperar **When** lanzo el flujo a mano desde GitHub **Then** se ejecuta igual que la ejecución programada.

## Fuera de alcance

- Avisos por correo cuando falle la ingesta: GitHub ya notifica los flujos fallidos al propietario del repositorio.
- Ajustar la frecuencia por fuente: de momento ambas se ejecutan a la vez.
- Ampliar el número de cursos ingeridos: se mantiene el alcance actual.

## Riesgos y cuidados

- **Los secretos van en los ajustes del repositorio**, nunca en el fichero del flujo, que sí se versiona.
- **La cadena de conexión debe ser la del *pooler*** (`aws-1-eu-west-1.pooler.supabase.com:5432`): la conexión directa de Supabase es solo IPv6 y los ejecutores de GitHub podrían no alcanzarla, igual que pasó desde local.
- Conviene una hora de poca actividad y no en punto, para no coincidir con el pico de trabajos programados de GitHub.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Ejecución manual del flujo en GitHub terminada en **Success** (2026-08-11)
- [x] Verificación contra la base de producción: 412 cursos actualizados por esa ejecución
- [x] Comprobación de que ningún secreto aparece en los registros de la ejecución
- [x] `/security-review`: el flujo solo lee el repositorio (`permissions: contents: read`), los secretos se inyectan como variables de entorno y no se imprimen

## Notas de implementación

Primera ejecución real desde GitHub Actions: **412 cursos actualizados** y el histórico de precios pasó de 412 a **724 filas**. Ese salto es la prueba de que las alertas de bajada de precio de la Fase 4 ya tienen de dónde alimentarse: hasta ahora el histórico era una foto fija.

Detalles que salieron de probarlo, no de suponerlo:

- Los scripts se ejecutan **sin `--env-file`**, leyendo variables del entorno. Se verificó en local reproduciendo esas condiciones antes de subir el flujo.
- Se usa el *pooler* de Supabase por la misma razón que en `HU-014`: la conexión directa es solo IPv6.
- Cada fuente en su paso con `if: !cancelled()`, de modo que si Udemy falla, Coursera se ingiere igualmente. Se prefirió eso a `always()` para no ejecutar nada si alguien cancela el flujo a mano.

## Estado

Cerrada.
