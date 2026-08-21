# HU-024 — Exportar mis datos

## Contexto

Cierra la deuda que HU-020 dejó escrita al implementar el borrado: se puede suprimir la
cuenta, pero no llevarse nada antes. El RGPD reconoce el derecho de portabilidad
(artículo 20) y exige entregar los datos «en un formato estructurado, de uso común y
lectura mecánica».

Nuestra política de privacidad, que ya está publicada, promete ese derecho «escribiendo
a hola@gourses.com». Ese buzón **no existe**, así que hoy la promesa no se puede
ejercer por ninguna vía. Es el mismo problema que motivó HU-020, con el mismo remedio:
que la persona lo haga por sí misma sin depender de que alguien atienda una petición.

Y hay un orden natural que conviene respetar: llevarse los datos debe poder hacerse
**antes** de borrarlos, porque después ya no hay nada que llevarse.

## Como persona con cuenta quiero descargarme lo que tenéis sobre mí para poder guardarlo o llevármelo a otro sitio antes de borrar la cuenta

## Criterios de aceptación

- **Given** que he entrado en mi cuenta
  **When** voy a `/mi-cuenta`
  **Then** encuentro cómo descargar mis datos, junto a las demás opciones de la cuenta

- **Given** que tengo cursos guardados y los avisos activados
  **When** descargo mis datos
  **Then** obtengo un fichero legible por máquina con mi correo, mi preferencia de
  avisos y la lista de mis favoritos con los datos de cada curso

- **Given** que no he entrado en mi cuenta
  **When** pido la ruta de exportación directamente
  **Then** no recibo ningún dato y se me lleva a la página de acceso

- **Given** que otra persona tiene sus propios favoritos
  **When** descargo mis datos
  **Then** en el fichero no aparece nada suyo

- **Given** que he descargado mis datos
  **When** el fichero viaja por la red y por el hosting
  **Then** ni la CDN ni el navegador lo guardan en caché

## Fuera de alcance

- Otros formatos (CSV, PDF). JSON ya cumple lo que el artículo 20 pide, y añadir
  formatos multiplica el trabajo sin dar ningún derecho nuevo.
- El histórico de avisos ya enviados (`price_alerts_sent`). Esa tabla es territorio del
  job: tiene RLS activada y **cero políticas** a propósito, así que ninguna sesión la
  lee. Abrirla para esto sería agrandar la superficie por un dato de poco valor —
  cuándo se te mandó un correo que ya tienes en tu bandeja.
- Exportar y borrar en un solo paso. Son dos decisiones distintas y conviene que lo
  sigan siendo.
- Enviar la exportación por correo. El fichero lleva datos personales; que salga solo
  por la sesión ya autenticada es más seguro que mandarlo a un buzón.

## Cuidados

- **La clave de servicio no puede entrar aquí**, igual que en HU-020. La exportación se
  arma con la sesión del visitante y la RLS decide qué filas se ven; nadie filtra por
  `user_id` a mano. Así, un fallo en el filtrado no puede convertirse en una fuga: la
  base de datos no le entregaría filas ajenas ni queriendo.
- **La respuesta no se cachea.** Es una descarga con datos personales servida desde una
  CDN; sin `Cache-Control: no-store` podría quedarse guardada y servirse a quien no
  debe. Es el fallo clásico de este tipo de endpoint.
- **El nombre del fichero no lleva el correo.** Queda escrito en la carpeta de descargas
  y en el historial del navegador; con la fecha basta para distinguirlo.
- Se devuelve como adjunto (`Content-Disposition: attachment`), no como página: un JSON
  con datos personales no debe renderizarse dentro del sitio.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: lógica cubierta, sin llamadas de red reales
- [x] Integración: contra base de datos de test, no de desarrollo/producción
- [x] E2E: un test por cada criterio de aceptación de arriba
- [x] `/security-review` ejecutado, sin hallazgos críticos/altos abiertos

## Estado

`Cerrada`

Unitarios (9), integración (4) y e2e (5, uno por criterio) en verde, y la suite completa
también: 272 unitarios, 69 de integración, 69 e2e. `/security-review` sin hallazgos.

## Lo que salió bien por venir de antes

Los cinco e2e pasaron a la primera, que no es lo habitual. El mérito no es de esta
historia: el ayudante de sesión de HU-019 ya sabía abrir sesión sin pasar por el correo,
y la RLS de HU-019 y HU-021 ya aislaba las tablas. Aquí solo hubo que juntarlo.

El test de aislamiento busca el correo y el título ajenos en el **fichero serializado
entero**, no solo en la lista de favoritos. Así, si algún día se añade una sección nueva
al fichero y cuela datos de otra persona, el test lo ve igualmente; comprobar solo la
lista habría dejado ese hueco abierto.

## Deuda que sigue abierta

- El buzón `hola@gourses.com`, que la política todavía necesita para acceso,
  rectificación, oposición y limitación. Portabilidad y supresión ya no dependen de él.
- El histórico de avisos enviados sigue fuera del fichero (ver «Fuera de alcance»).
- La plantilla del correo de acceso está en inglés, la de fábrica de Supabase. No es de
  esta historia, pero se nota en un sitio en español.
