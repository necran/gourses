# HU-044 — Que cada cambio se verifique solo, sin depender de que alguien lo lance

## Contexto

Fase 0/6, higiene del proyecto. Detectado al revisar el repositorio el 2026-09-13.

El repositorio tiene dos workflows, `ingesta.yml` e `ingesta-es.yml`, y **ninguno
ejecuta tests**. Hoy la única red de seguridad es que alguien se acuerde de lanzar en
local `npm run lint`, `npx tsc --noEmit`, `npx vitest run`, `npm run test:integration`
y `npx playwright test`. Eso ya ha fallado en la práctica: HU-038 dejó roto un test de
`favoritos.spec.ts` (dos botones pasaron a contener «cerrar sesión») y se cerró la
historia anotándolo como «fallo intermitente ajeno». Estuvo así hasta que se unieron
las ramas, días después.

Netlify compila al desplegar, pero eso llega tarde y solo mira el build: no ejecuta ni
lint ni tests, y además un despliegue cuesta créditos, así que no sirve como
verificación.

## Como quien mantiene el proyecto quiero que cada cambio subido se compruebe automáticamente para enterarme de lo que rompo cuando lo rompo, y no días después

## Criterios de aceptación

- **Given** una rama subida al repositorio **When** llega el cambio **Then** se ejecutan
  solas la comprobación de estilo, la de tipos, los tests unitarios y la compilación
- **Given** una verificación que falla **When** miro el repositorio **Then** veo cuál de
  los cuatro pasos ha fallado y su salida, sin tener que reproducirlo en local
- **Given** que empujo dos veces seguidas a la misma rama **When** la primera
  verificación sigue corriendo **Then** se cancela y solo termina la del último cambio
- **Given** la verificación **When** se ejecuta **Then** no necesita ningún secreto ni
  acceso a ninguna base de datos: nada de lo que corre ahí toca datos reales
- **Given** que alguien añade una página que se prerenderiza leyendo la base de datos
  **When** se verifica **Then** la compilación falla, en vez de descubrirlo al desplegar

## Fuera de alcance

- **Los tests de integración y los e2e.** Necesitan una base de datos: la del NAS, que
  por regla del proyecto no se expone a internet, o la de producción, donde no se
  siembran ni se borran filas. Se siguen ejecutando en local antes de cerrar cada
  historia, que es lo que ya exige `CLAUDE.md`. Si algún día hay una base de test
  alcanzable, esta historia se amplía.
- **Desplegar desde el workflow.** El despliegue lo dispara Netlify al empujar a `main`
  y se agrupa a propósito por el coste en créditos (ver `CLAUDE.md`).
- **Bloquear la fusión si falla.** Requiere reglas de protección de rama en GitHub, que
  son configuración del repositorio y no del código; se puede añadir después.

## Diseño

Un workflow nuevo, `.github/workflows/verificacion.yml`, con cuatro pasos en un solo
trabajo: `npm run lint`, `npx tsc --noEmit`, `npm test` y `npm run build`. En pasos
separados para que la pestaña de Actions diga cuál cayó sin abrir el registro entero.

- **Sin secretos ni variables**: comprobado el 2026-09-13 que la compilación no los
  necesita. Todas las rutas se renderizan bajo petición (`ƒ` en la salida del build) y
  la única prerenderizada, `robots.txt`, no consulta nada. Si eso cambiara, el build
  fallaría avisando, que es justo el último criterio de aceptación.
- **`npm test` es seguro aquí**: los ficheros de `tests/integration` se saltan solos
  cuando no hay `DATABASE_URL` ni `TEST_DATABASE_URL`, así que en el ejecutor corre solo
  lo unitario.
- Node 24 y `npm ci`, igual que los workflows de ingesta, para que el ejecutor use el
  mismo runtime que Netlify (fijado en `netlify.toml`).

## Checklist de tests (obligatorio antes de cerrar)

- [x] Los cuatro pasos, ejecutados en local uno a uno tal y como los lanza el
      workflow, pasan: `npm run lint` (0 errores, 1 aviso preexistente en
      `duration.ts`), `npx tsc --noEmit`, `npm test` (511 pasan, 115 omitidos) y
      `npm run build`
- [ ] **El workflow no se ha ejecutado nunca en GitHub.** Falta verlo en verde allí y,
      sobre todo, verlo **fallar a propósito** con algo roto: un workflow que nunca ha
      fallado no está probado, solo escrito
- [x] Unitarios, integración y e2e: no cambia código de la aplicación. Lo unitario y la
      compilación quedan comprobados arriba; integración y e2e siguen como estaban
- [x] `/security-review`: sin hallazgos (ver abajo)

## Estado

`Bloqueada (pendiente de su primera ejecución en GitHub)`

No se marca cerrada a propósito: la regla del proyecto es que una historia no se cierra
con pendientes, y aquí falta justo la prueba que importa. `act` (que ejecuta Actions en
local) no está instalado, así que la única forma de comprobarlo es empujar la rama.

**Ojo antes de empujar:** según HU-014, Netlify genera previsualizaciones privadas de
las ramas, así que empujar esta gastaría créditos aunque no se toque `main`. Queda a
decisión de quien lleva el proyecto: o se empuja asumiendo ese coste, o se espera y
viaja con el siguiente lote que se despliegue.

### Revisión de seguridad

Sin hallazgos:

- **`permissions: contents: read`**, el mínimo: el workflow no publica nada ni escribe
  en el repositorio.
- **No usa ningún secreto**, así que no hay nada que se pueda filtrar en el registro,
  y una rama de un tercero no obtendría credenciales al dispararlo.
- **No toca ninguna base de datos**: los tests de integración y los e2e, que sí lo
  harían, se quedan fuera a propósito.
- Acciones fijadas a versión mayor (`actions/checkout@v4`, `actions/setup-node@v4`),
  igual que en los workflows de ingesta ya existentes.
