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

- [ ] Ejecución manual del flujo en GitHub que termina en verde
- [ ] Verificación de que la base de producción queda actualizada tras esa ejecución
- [ ] Comprobación de que ningún secreto aparece en los registros de la ejecución
- [ ] `/security-review` sin hallazgos críticos ni altos

## Estado

En progreso.
