# HU-053 — Resúmenes con IA generados cada día en producción

## Contexto

Fase 6, estrategia de tráfico orgánico (2026-09-15). HU-052 arregló el job de resúmenes,
pero sigue lanzándose a mano y con `.env.local`, es decir, **contra la base de
desarrollo**. En producción no hay ningún resumen: las fichas que ve Google son la
descripción copiada de la plataforma, casi siempre en inglés.

El usuario decidió seguir con la **cuenta gratuita** de Gemini (2026-09-15). Con una
cuota diaria limitada, la única forma de cubrir los ~3.800 cursos en español (y luego el
resto) es ir poco a poco, todos los días, sin que nadie tenga que acordarse. HU-052 ya
deja el job preparado: sigue por orden y se detiene al agotar la cuota.

## Como responsable del sitio quiero que los resúmenes se generen solos cada día en producción para que el contenido propio en español crezca sin intervención

## Criterios de aceptación

- **Given** la tarea programada **When** llega su hora **Then** ejecuta el job de
  resúmenes contra la base de producción
- **Given** que no existe el secreto `GEMINI_API_KEY` en GitHub **When** se ejecuta la
  tarea **Then** se salta sin fallar, en vez de quedar en rojo cada día
- **Given** que se agota la cuota diaria **When** el job se detiene **Then** la ejecución
  termina en verde, porque es lo esperado, y al día siguiente sigue por donde lo dejó
- **Given** la tarea **When** se quiere probar sin esperar **Then** se puede lanzar a mano
  desde la pestaña Actions

## Fuera de alcance

- **Pasar a un plan de pago de Gemini** (decisión del usuario: cuenta gratuita).
- **Resumir en la misma tarea que la ingesta.** Va aparte: la ingesta ya roza su tope de
  tiempo (HU-015, 90 min) y un fallo de la IA no debe afectar al catálogo.

## Diseño

- `.github/workflows/resumenes.yml`, programado a las **09:37 UTC**: después de la
  ingesta (04:17) y de la ingesta en español (07:17), y después de que Google reinicie la
  cuota diaria (medianoche de la costa del Pacífico, 07:00–08:00 UTC).
- Mismo patrón que los avisos de precio: la clave va a `env` del job y el paso se salta
  si está vacía.
- `timeout-minutes: 150`. Cada resumen se guarda en cuanto se genera, así que un corte
  por tiempo no pierde nada.
- `concurrency` propio para que dos ejecuciones no se solapen.

## Dependencias antes de la primera ejecución

1. Migración `0009` aplicada en Supabase Cloud (la columna de la huella, HU-052).
2. Secreto `GEMINI_API_KEY` creado en GitHub (lo crea el usuario; nunca pasa por aquí).
3. El código fusionado en `main`: GitHub solo ejecuta las tareas programadas de la rama
   principal.

## Checklist de tests (obligatorio antes de cerrar)

- [ ] Unitarios: no aplica lógica nueva (el comportamiento es de HU-052, ya probado)
- [ ] Integración: no aplica
- [ ] Verificación: primera ejecución real en GitHub, con resúmenes guardados en
      producción y el caso de cuota agotada terminando en verde
- [ ] `/security-review` sin hallazgos críticos ni altos

## Estado

`Bloqueada (pendiente del despliegue y de su primera ejecución en GitHub)`
