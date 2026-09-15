# HU-051 — Google Analytics, solo con consentimiento y contado en la política

## Contexto

Fase 6. El 2026-09-14 apareció en el árbol de trabajo, sin commitear, un cambio en
`src/app/layout.tsx` que carga Google Analytics (`G-DGXS33BH5D`) en todas las páginas
nada más entrar. La decisión de producto es **mantener la analítica**, pero hacerla
bien. Tal como estaba tenía cuatro problemas:

1. **Contradice la política de privacidad**, que dice literalmente «No usamos
   herramientas de analítica ni rastreadores publicitarios» y, en su descripción,
   «sin analítica, sin rastreadores».
2. **Se carga sin consentimiento.** No hay ningún aviso de cookies en el sitio. En
   España, las cookies de analítica no son técnicas y necesitan consentimiento previo
   (LSSI art. 22.2 y criterio de la AEPD).
3. **El test de la política no lo detectaría**: `e2e/legales.spec.ts` comprueba que el
   texto «no usamos herramientas de analítica» siga en la página, y el texto no cambió.
   Habría pasado en verde con la web haciendo lo contrario.
4. **Manda tráfico falso a la propiedad real.** Con el identificador escrito a fuego,
   cada ejecución de los e2e y cada visita en local cuenta como una visita en Google
   Analytics, y ensucia los datos que se quieren medir.

Lo que exige la AEPD, en lo que afecta a esta historia:

- Ninguna cookie no esencial antes del consentimiento.
- Rechazar tan fácil como aceptar: los dos botones en el primer aviso, con la misma
  visibilidad y el mismo número de clics.
- Nada de diseños que empujen a aceptar.
- Poder cambiar de opinión después, tan fácil como se dio.

## Como visitante quiero decidir si mi visita se mide antes de que se mida para que no se recojan datos míos sin haberlo aceptado

## Criterios de aceptación

- **Given** que entro por primera vez **When** carga la página **Then** veo un aviso que
  me pregunta si acepto la analítica, con «Aceptar» y «Rechazar» igual de visibles, y
  **no se ha cargado nada de Google** todavía
- **Given** ese aviso **When** pulso «Rechazar» **Then** el aviso desaparece, no se carga
  Google Analytics, y no me lo vuelve a preguntar en las siguientes páginas
- **Given** ese aviso **When** pulso «Aceptar» **Then** se carga Google Analytics, y en
  las siguientes visitas se carga sin volver a preguntar
- **Given** que ya decidí **When** quiero cambiar de opinión **Then** hay un enlace
  permanente (en el pie) que vuelve a abrir la elección, y retirar el consentimiento
  deja de cargar la analítica
- **Given** la política de privacidad **When** la leo **Then** explica que se usa Google
  Analytics, para qué, que solo con consentimiento, qué cookies pone, que Google trata
  los datos y cómo retirar el consentimiento — y ya no dice que no hay analítica
- **Given** el entorno local o los tests **When** se navega por la web **Then** no se
  carga Google Analytics ni aparece el aviso, porque no hay identificador configurado
- **Given** que navego sin JavaScript **When** entro **Then** no se carga ninguna
  analítica (sin JavaScript no hay nada que medir) y la web funciona igual

## Fuera de alcance

- **Otras herramientas** (publicidad, píxeles, mapas de calor). Solo Google Analytics.
- **Un gestor de consentimiento de terceros** (CMP). Con un único proveedor y una única
  finalidad, un aviso propio es suficiente y no añade otro script externo.
- **Configurar la propiedad en Google Analytics** (retención, señales de Google,
  anonimización): es panel de Google, lo hace quien lleva la cuenta.
- **Revisión legal profesional** de los textos, que sigue pendiente desde HU-013.

## Diseño

- **El identificador sale de una variable de entorno**, `NEXT_PUBLIC_GA_ID`, y no del
  código. Sin ella no se pinta ni el aviso ni el script. Se fija en `netlify.toml`
  (`[build.environment]`), como `NEXT_PUBLIC_SITE_URL`: no es un secreto —acaba en el
  navegador— y así queda en el historial. En `.env.local` no se pone, y eso resuelve
  el tráfico falso de local y de los tests.
- **Un componente de cliente** decide qué pintar según la elección guardada: nada si aún
  no hay identificador, el aviso si no se ha decidido, y el `<Script>` de Google solo si
  se aceptó. La documentación de esta versión confirma que `<Script>` con
  `afterInteractive` solo se inyecta cuando el componente que lo contiene se pinta, así
  que no pintarlo equivale a no cargarlo.
- **La elección se guarda en el navegador** (`localStorage`), no en el servidor ni en una
  cookie que viaje con cada petición: así las páginas no tienen que leer nada nuevo en el
  servidor. Guardar la propia elección es técnico y no necesita consentimiento.
- **El layout pierde el script a fuego** y gana ese componente, y el pie un enlace
  «Configurar cookies».

## Cuidados

- **No cargar nada de Google antes de aceptar**, tampoco «solo el script sin cookies»: el
  propio script ya envía la dirección IP a Google.
- **Botones equivalentes**: mismo tamaño, mismo peso visual, en la primera capa. Nada de
  «Aceptar» destacado y «Rechazar» como enlace gris.
- **El test de la política tiene que cambiar**, no silenciarse: debe exigir que se
  declare la analítica y dejar de exigir que se niegue.
- **Si falla el almacenamiento** (modo privado estricto), se trata como «sin decidir»
  y no se carga nada, en vez de asumir que se aceptó.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: lectura y escritura de la elección (aceptado, rechazado, sin decidir,
      valor corrupto, almacenamiento bloqueado → nunca se da por aceptado)
- [x] E2E: un test por criterio de aceptación, comprobando en las peticiones de red que
      no sale ninguna hacia Google antes de aceptar ni después de rechazar
- [x] E2E: la política declara la analítica; se corrige el test de HU-013
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Terminada` (2026-09-15)

## Notas de implementación

- `src/lib/id-analitica.ts`: valida el identificador (`G-` y alfanuméricos). Va en un
  módulo sin React porque lo leen el layout y el pie, que son de servidor; la primera
  versión lo tenía junto al almacén con hooks y la compilación falló.
- `src/lib/consentimiento.ts`: la elección en `localStorage`, validada al leer. Si el
  almacenamiento falla al leer es «sin decidir»; lo decidido con él bloqueado vale solo
  mientras dure la página. Se sincroniza entre pestañas.
- `src/components/analitica.tsx`: no pinta nada hasta hidratar; después, aviso, script o
  nada. Retirar el consentimiento activa `ga-disable-<id>` y borra las cookies `_ga`.
  Los dos botones comparten una única clase CSS.
- `src/components/configurar-cookies.tsx`, en el pie, solo si hay identificador.
- `NEXT_PUBLIC_GA_ID` en `netlify.toml`; no en `.env.local`.

### Por qué hay una segunda configuración de Playwright

Los criterios con la analítica activa necesitan un servidor **con** identificador, y el
de la suite normal va sin él a propósito (ese es otro criterio). No se pueden levantar
dos `next dev` en la misma carpeta, así que `playwright.analitica.config.ts` compila y
arranca en el puerto 3200 con `G-PRUEBA0000`, y las peticiones a Google se interceptan:
nada llega a la propiedad real. Se ejecuta con `npm run test:e2e:analitica`.

Reparto de criterios: los cuatro del aviso y el de sin JavaScript están en
`e2e-analitica/`; el de la política en `e2e/legales.spec.ts`; el de local y tests en
`e2e/analitica-sin-configurar.spec.ts`.

### Resultado de los tests

- Unitarios (`npm test`): 596 pasan, 26 nuevos.
- E2E (`npx playwright test`): 201 pasan. La primera pasada dio 2 fallos en HU-050 que
  eran un test mal planteado de esa historia, no de esta (anotado en HU-050).
- E2E de la analítica (`npm run test:e2e:analitica`): 5 pasan.
- Integración (`npm run test:integration`): 122 pasan. Una pasada anterior dio 3 fallos
  por respuestas 503 de la API de Udemy, distintos en cada intento; una petición directa
  confirmó que la API volvió a responder y la repetición pasó entera.

Durante el cierre el NAS dejó de responder: al reiniciarlo se registró en Tailscale como
un equipo nuevo con otra IP, y hubo que actualizar `.env.local` (no se commitea).

### Revisión de seguridad

Sin hallazgos críticos ni altos:

- **Inyección en el script en línea**: el identificador acaba dentro de JavaScript. Solo
  sale de una variable de compilación y se valida con una expresión estricta; los tests
  unitarios prueban comillas, `</script>` y espacios.
- **Consentimiento falsificable o asumido**: lo guardado solo vale si es exactamente
  `aceptado` o `rechazado`; un fallo del almacenamiento nunca da «aceptado».
- **Nada antes de consentir**: sin hidratar no se pinta el script; los e2e comprueban en
  la red que no sale ninguna petición a Google antes de aceptar ni después de rechazar.
- **Enlace externo** a la política de Google con `rel="noopener noreferrer"`.
- **Datos**: la elección no sale del navegador; no hay entrada nueva al servidor.

### Pendiente fuera de esta historia

- Configurar retención y señales de Google en el panel de Google Analytics (fuera de
  alcance).
- Cambiar la contraseña de Postgres del NAS: se mostró por error en la sesión de trabajo
  al revisar `.env.local` (no está en el repositorio).
