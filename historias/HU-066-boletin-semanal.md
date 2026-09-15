# HU-066 — Boletín semanal, solo para quien se apunta

## Contexto

Fase 6, tráfico recurrente (2026-09-15). Quien encuentra el sitio desde Google vuelve si
algo le recuerda que existe. Ya hay dos piezas hechas: los cursos nuevos en español (HU-059)
y el histórico de precios con envío por Resend (HU-021). Un boletín semanal las junta.

Decisiones tomadas con el usuario:

- **Solo con cuenta y casilla aparte, desmarcada.** Es comunicación comercial por correo
  (enlaza a cursos con comisión): exige consentimiento expreso (RGPD 6.1.a, LSSI art. 21).
  El correo de la cuenta se dio para identificarse, no para esto, así que no se apunta a
  nadie por tener cuenta. Con cuenta, además, el correo ya está verificado y no hace falta
  un doble opt-in propio.
- **Contenido con datos**: los cursos nuevos en español de los últimos 7 días y las mayores
  bajadas de precio de la semana en cursos en español. Si no hay nada, no se envía.
- **Baja en cada correo sin iniciar sesión**: un enlace con un token secreto por persona que
  lleva a una página con un botón. Con botón y no al abrir el enlace: los antivirus de correo
  abren los enlaces solos y darían de baja a quien no lo pidió.

## Como persona con cuenta quiero recibir, si lo pido, un resumen semanal de cursos nuevos y bajadas para no tener que acordarme de mirar

## Criterios de aceptación

- **Given** una cuenta **When** abro «Mi cuenta» **Then** el boletín aparece desmarcado y no
  recibo nada hasta marcarlo
- **Given** «Mi cuenta» **When** marco el boletín y guardo **Then** sigue marcado al volver, y
  «Qué guardamos» y la descarga de mis datos lo reflejan
- **Given** un boletín recibido **When** abro su enlace de baja, sin sesión, y pulso el botón
  **Then** dejo de estar apuntado; abrir el enlace sin pulsar no da de baja
- **Given** un enlace de baja que no es válido **When** lo abro **Then** me lo dice y me ofrece
  «Mi cuenta»
- **Given** la política de privacidad **When** la leo **Then** declara el boletín, su base
  (consentimiento) y cómo darse de baja
- **Given** el job semanal **When** se ejecuta **Then** envía un correo a cada persona
  apuntada, con los cursos nuevos y las bajadas, y no a quien no lo está (integración)
- **Given** el job **When** se ejecuta dos veces la misma semana **Then** no repite el envío
  (integración)
- **Given** una semana sin cursos nuevos ni bajadas **When** se ejecuta **Then** no envía nada
  (unitarios)

## Fuera de alcance

- **Suscripción sin cuenta.** Pediría doble opt-in propio y guardar correos de personas sin
  cuenta; se valorará con datos de uso.
- **Personalizar el contenido** por temas o categorías.
- **Encender el envío en producción**: el workflow queda listo y se salta mientras no exista
  `RESEND_API_KEY`, como los avisos de precio.

## Diseño

- Migración `0017`: `boletin_suscripciones` (activo, cuándo se consintió, token de baja) con
  RLS de propietario; `boletines_enviados` sin políticas (solo el job); función
  `baja_boletin(token)` `security definer`, ejecutable por `anon`, que solo desactiva la fila
  de ese token.
- `src/lib/boletin/contenido.ts`: composición pura del correo (texto y HTML escapado, cabecera
  `List-Unsubscribe`). `job.ts`: lectura con Postgres directo, envío y registro por semana.
- Reutiliza el enviador de HU-021 (Resend o registrador sin clave) y `decidirAviso` para qué
  bajada merece contarse.
- `scripts/boletin-semanal.mjs` y workflow semanal (lunes).

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: semana, token, orden de bajadas, composición, escapado, sin contenido
- [x] Integración: job (a quién envía, sin repetir), baja por token, RLS
- [x] E2E: un test por criterio visible en la web
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada` (2026-09-15)

### Lo hecho

- **Base de datos:** migración `0017`, aplicada en desarrollo (no en la base de test, que no
  tiene `auth.users`, igual que `0006`).
- **Código del boletín:**
  - `src/lib/boletin/`: contenido, preferencias y job.
  - `scripts/boletin-semanal.mjs` (`npm run boletin:semanal`).
  - `.github/workflows/boletin.yml`, los lunes a las 07:23 UTC.
- **«Mi cuenta»:**
  - casilla del boletín, desmarcada
  - línea «Boletín semanal» en «Qué guardamos»
  - `preferencias.boletinSemanal` en la descarga de datos, que pasa a **formato 2**
- **Página de baja:** `/boletin/baja?t=…`, sin sesión y con botón; lleva `noindex`.
- **Privacidad:** apartado «Boletín semanal, solo si te apuntas», finalidad ampliada, Resend
  también para avisos y boletín. Fecha de actualización: 15 de septiembre de 2026.
- **Mensaje y envío:** el mensaje admite cabeceras y el enviador de Resend las pasa; el
  boletín usa `List-Unsubscribe`.
- **Test de avisos:** `avisos.spec` busca el botón «Guardar» exacto, porque ahora hay dos
  botones que empiezan así.

### Lo que dicen los datos de desarrollo (hallazgo)

El job, ejecutado en seco sobre la base de desarrollo, no enviaría nada esta semana:
- **Cursos nuevos:** ningún curso en español publicado en los últimos 7 días. El último es
  del 1 de septiembre, y solo hay 2 en 30 días.
- **Bajadas de precio:** una sola en la última semana, y de un curso en inglés.

Con este catálogo, un boletín semanal saldría pocas semanas. Conviene mirarlo con los datos
de producción antes de encenderlo; si se confirma, las alternativas son hacerlo quincenal o
mensual, o contar también cursos en inglés.

**Al desplegar:**
1. Aplicar `0017` en Supabase Cloud. Solo crea tablas y una función.
2. El workflow se salta mientras no exista `RESEND_API_KEY`.
3. Antes de encenderlo, revisar lo anterior.

### Resultado de los tests

- **Unitarios** (`npm test`): 799 pasan.
- **Integración** (`npm run test:integration`): 152 pasan. Hay 6 nuevos del boletín: a quién
  envía, sin repetir, reintento tras fallo, baja por token y RLS.
- **E2E** (`npx playwright test`): 270 pasan, 5 nuevos, en 2,2 min.
  - La primera pasada dio 3 fallos por tiempo en otras historias: navegaciones de más de 5 s,
    con el servidor de desarrollo cargado.
  - Reiniciado el servidor, la suite entera pasa.

### Revisión de seguridad

Sin hallazgos críticos ni altos.
- **Baja sin sesión:** la función `baja_boletin` es `security definer` con `search_path`
  vacío. Solo desactiva la fila del token y solo devuelve si existía. El token son 122 bits
  aleatorios y la acción lo valida como UUID antes de llegar a la base. La redirección se
  construye con ese UUID ya validado, así que no es un redirector abierto.
- **Tablas:** RLS de propietario en `boletin_suscripciones`, y ninguna política en
  `boletines_enviados`. Comprobado en integración que sin sesión no se lee ninguna de las dos.
- **Clave de servicio:** la web nunca la usa. El job va por Postgres directo, fuera de la web.
- **Correo:** los títulos y las divisas de terceros se escapan en el HTML (con test). Los logs
  no llevan direcciones de correo.
- **Consentimiento:** desmarcado de fábrica y con fecha guardada. Si la lectura falla, la
  casilla sale desmarcada.
- **Tests:** los usuarios de prueba (`zzz-hu066-…@example.com`) se borran siempre en
  `finally` o `afterAll`.

**Riesgo bajo aceptado:** quien reenvíe un boletín reenvía su enlace de baja, y quien lo
reciba podría darle de baja. Pulsar ese enlace no revela nada y la persona puede volver a
apuntarse.
