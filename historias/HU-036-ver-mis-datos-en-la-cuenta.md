# HU-036 — Ver en la propia cuenta qué datos tenéis sobre mí

## Contexto

Fase 3, cerrando deuda de HU-024 y de la política de privacidad publicada.

HU-024 dio el **derecho de portabilidad** (RGPD art. 20): descargar un JSON con todo
lo que se guarda. Pero el **derecho de acceso** (art. 15) —«dime qué datos tienes
sobre mí y para qué»— hoy solo se puede ejercer de dos formas, y ninguna sirve:

1. Descargando ese JSON y leyéndolo. Es un fichero para máquinas; pedirle a alguien
   que abra un `.json` para saber qué correo tienes suyo es no responder.
2. Escribiendo a `hola@gourses.com`, como dice la sección «Tus derechos» de
   `/privacidad`. **Ese buzón no existe** (deuda arrastrada desde HU-020 y HU-024).

El dato es mínimo —el correo, dos fechas técnicas, la lista de favoritos y un
interruptor— así que enseñarlo en lenguaje llano dentro de `/mi-cuenta` es tanto lo
correcto para la persona como la forma más barata de cumplir el artículo 15 sin
depender de que alguien atienda un correo.

Encaja además con HU-035: esa historia añade el recuento de favoritos a la cuenta;
esta lo enmarca dentro de un «esto es todo lo que tenemos» completo.

## Como persona con cuenta quiero ver de un vistazo qué datos guardáis sobre mí y para qué, sin descargar ni pedir nada, para saber a qué me expongo

## Criterios de aceptación

- **Given** que he entrado en mi cuenta
  **When** abro `/mi-cuenta`
  **Then** encuentro un resumen en lenguaje llano de todo lo que se guarda sobre mí:
  mi correo, cuándo se creó la cuenta y cuándo entré por última vez, cuántos cursos
  tengo en favoritos y si los avisos de precio están activados

- **Given** que estoy viendo ese resumen
  **When** lo leo
  **Then** cada dato dice para qué se usa y durante cuánto tiempo se conserva, en una
  frase, coherente con lo que declara `/privacidad`

- **Given** que estoy viendo ese resumen
  **When** quiero llevarme los datos o borrarlos
  **Then** desde ahí mismo llego a la descarga (HU-024) y al borrado (HU-020), sin
  buscarlos por la página

- **Given** que no he entrado en mi cuenta
  **When** intento abrir `/mi-cuenta`
  **Then** se me lleva a la página de acceso, sin filtrar nada (ya ocurre; no se
  rompe)

- **Given** que otra persona tiene sus propios datos y favoritos
  **When** miro mi resumen
  **Then** no aparece nada suyo: ni su correo, ni sus fechas, ni su recuento

- **Given** que la política de privacidad describe el derecho de acceso
  **When** la leo tras esta historia
  **Then** dice que se ejerce desde la propia cuenta, no solo escribiendo a un buzón

## Fuera de alcance

- **Editar nada desde este resumen.** Es de solo lectura. Cambiar el correo es
  HU-037; el interruptor de avisos ya tiene su sección; borrar y exportar, las suyas.
  Este resumen enlaza a esas acciones, no las duplica.
- **Los registros técnicos de terceros** (logs de Netlify, de Supabase, de Resend).
  La política ya los menciona como «registros técnicos» con su propia retención; no
  son datos que este sitio guarde en su base y no se listan aquí uno a uno.
- **El histórico de avisos ya enviados** (`price_alerts_sent`). HU-024 lo dejó fuera
  con motivo —tabla del job, con RLS y cero políticas, valor bajo (un correo que ya
  tienes en la bandeja)— y esta historia mantiene esa decisión.
- **Un panel para quien no tiene cuenta.** Sin cuenta no se guarda nada que permita
  identificar a nadie más allá de esos registros técnicos, como ya dice la política.
- **Descargar este resumen** como PDF o similar. Para llevárselo está la exportación
  JSON de HU-024.

## Cuidados

- **Todo sale por la sesión del visitante y la RLS**, nunca por la clave de servicio,
  igual que en HU-020 y HU-024. El correo y las fechas se leen de `auth.getUser()`
  (que valida contra Supabase); los favoritos y la preferencia de avisos, de sus
  tablas con RLS. Ninguna consulta filtra por `user_id` a mano.
- **Las fechas técnicas ya están declaradas.** `/privacidad` dice: «Junto al correo se
  guardan las fechas de creación y último acceso de la cuenta». Este resumen las
  enseña; no introduce ningún dato nuevo que obligue a reescribir la base jurídica.
- **Los textos de «para qué» y «cuánto tiempo» tienen una sola fuente de verdad.** Si
  el resumen dice una retención y `/privacidad` dice otra, una de las dos miente.
  Conviene que las frases vivan en un módulo compartido (o que un test compruebe que
  el resumen no contradice a la política) para que no se separen.
- **El resumen no se cachea en la CDN.** Lleva el correo y las fechas de una persona;
  la página `/mi-cuenta` ya debe servirse sin caché por lo que hay en ella, pero esta
  historia lo vuelve más sensible y el test debe fijarlo (`Cache-Control` sin
  `public`, y `noindex` como hasta ahora).
- **Si falla la lectura de una parte** (p. ej. la preferencia de avisos), el resto del
  resumen se muestra igual y esa línea dice «no disponible ahora mismo». Gestionar la
  cuenta no puede depender de que se pinte un resumen informativo.

## Notas de implementación

- **Sin migración.** Solo lecturas.
- Toca `src/app/mi-cuenta/page.tsx` y su CSS (nueva `.seccion` «Qué guardamos sobre
  ti», arriba del todo o justo tras la identidad), y `src/app/privacidad/page.tsx`
  (la frase de «acceso» pasa a mencionar la cuenta).
- Una función `resumenDeCuenta(client)` en `src/lib/cuenta/` que reúna correo, fechas,
  recuento de favoritos y estado de avisos en un objeto, para probar el armado sin
  base de datos con un cliente falso, y para que la serialización de HU-024 y este
  resumen puedan compartir de dónde sale cada campo.
- Las fechas se muestran en formato humano y en la zona del visitante si es viable, o
  en un formato neutro (`10 de septiembre de 2026`) si no; nunca un ISO crudo.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: `resumenDeCuenta` arma el objeto; formatea las fechas (día en UTC,
      sin depender de ICU); marca solo la línea que no pudo leerse; 0 favoritos se
      muestra como 0, no como «no disponible»
- [x] Unitarios: `FINALIDAD_Y_CONSERVACION` nombra el plazo y la base jurídica, para
      que no se pierdan en una edición
- [x] Integración: el resumen de A cuenta solo lo suyo (recuento) — el aislamiento
      del correo y las fechas se cubre en e2e con dos cuentas reales
- [x] E2E: un test por cada criterio de aceptación de arriba (6 de 6)
- [x] E2E: el resumen de A no muestra el correo ni el recuento de B (dos contextos)
- [x] E2E: el resumen y `/privacidad` dicen los dos «mientras tengas la cuenta»
- [x] `/security-review` ejecutado, sin hallazgos críticos/altos abiertos

## Estado

**Cerrada** (probada y fusionada; pendiente de desplegar con el siguiente lote).

- Unitarios: 433 pasan (12 nuevos entre `resumen` y el ajuste de `exportacion`).
- Integración: 109 pasan.
- E2E: los 6 de `ver-mis-datos.spec.ts`. El único fallo de la suite completa,
  `seo.spec.ts:13`, es anterior y ajeno (pasa 3/3 en aislamiento).
- Revisión de seguridad: sin hallazgos. Es un resumen de solo lectura sobre datos
  que la persona ya posee, servido por la sesión + RLS; ninguna consulta nueva,
  ninguna entrada de usuario, sin `dangerouslySetInnerHTML`.

## Ajustes respecto al plan

- **`resumenDeCuenta` quedó como función pura**, no `(client)`: recibe lo que la
  página ya leyó (correo y fechas de `getUser()`, recuento de `contarFavoritos` de
  HU-035, avisos de `avisosActivados`). Igual que `exportacion.ts`, para probarlo
  sin base de datos.
- **La coherencia con `/privacidad` es un test e2e**, no un módulo compartido:
  forzar la constante en medio de la prosa de la política la dejaba rígida. El e2e
  comprueba que las dos páginas siguen diciendo «mientras tengas la cuenta».
- **La caché**: `/mi-cuenta` es dinámica desde HU-018 (lee la sesión) y va
  `noindex`; el runtime de Next en Netlify no cachea al borde una página que usa
  `cookies()`, y sin `Cache-Control: public` ningún intermediario la guarda. No se
  añade cabecera en la página porque el App Router no la expone ahí; donde sí se
  puede y sí lleva datos personales —la ruta de descarga— ya está el `no-store`
  desde HU-024.
- **De paso**: el fichero de exportación (HU-024) no incluía el último acceso,
  aunque `/privacidad` lo declara como dato guardado. Se añadió `ultimoAccesoEn` a
  `componerExportacion` para que las dos vías del RGPD digan lo mismo.
