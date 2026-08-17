# HU-020 — Borrar mi cuenta

## Contexto

Cierra la deuda que contrajimos en HU-018 al empezar a guardar datos personales, y que
HU-019 agrandó al añadir los favoritos.

El RGPD reconoce el derecho de supresión (artículo 17), y nuestra propia política de
privacidad ya promete que «si pides que la borremos, se elimina tu correo y todo lo
asociado a él». Hoy eso es papel mojado: no hay botón, y tampoco hay buzón donde
pedirlo, porque `hola@gourses.com` sigue pendiente. Una promesa que no se puede
ejercer es peor que no haberla hecho.

## Como persona con cuenta quiero borrarla yo mismo para dejar de tener datos aquí sin depender de que alguien atienda mi petición

## Criterios de aceptación

- **Given** que he entrado en mi cuenta
  **When** voy a `/mi-cuenta`
  **Then** encuentro cómo borrar la cuenta, con un aviso de que no tiene vuelta atrás

- **Given** que estoy en el formulario de borrado
  **When** no confirmo escribiendo mi correo exactamente
  **Then** no se borra nada y se me dice qué falta

- **Given** que confirmo escribiendo mi correo
  **When** envío el formulario
  **Then** la cuenta se borra, se cierra la sesión y se me confirma que ya no queda nada

- **Given** que he borrado mi cuenta
  **When** intento entrar en `/mi-cuenta` o `/favoritos`
  **Then** se me lleva a la página de acceso, porque ya no hay sesión

- **Given** que tenía cursos guardados
  **When** borro la cuenta
  **Then** esos favoritos desaparecen con ella

## Fuera de alcance

- Exportar los datos antes de borrarlos (derecho de portabilidad). Merece su propia
  historia; lo que hay hoy —un correo y una lista de cursos— es poco y se puede pedir
  por escrito mientras tanto.
- Un periodo de gracia o papelera para recuperar la cuenta. Se borra y se acabó, que
  es lo que la persona pide; anunciar lo contrario sería mentir.
- Borrar la cuenta desde el correo, sin sesión iniciada.

## Cuidados

- **La clave de servicio no puede entrar aquí.** Borrar un usuario de `auth.users` es
  una operación de administración, y esa clave salta la RLS por completo: si estuviera
  en código alcanzable desde una página, un fallo en cualquier otra parte del sitio
  daría acceso a todo (ver `.claude/rules/seguridad.md`). Se resuelve con una función
  en la base de datos que borre **solo a quien la llama**, atada a `auth.uid()`.
- Esa función corre con privilegios elevados, así que tiene que estar blindada contra
  el secuestro del `search_path`, que es la forma clásica de convertir una función
  `security definer` en una escalada de privilegios.
- Es irreversible: la interfaz debe pedir una confirmación que no se pulse sin querer.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: la confirmación solo vale si coincide con el correo de la cuenta
- [x] Integración: **A no puede borrar a B** llamando a la función; sin sesión no borra
      a nadie
- [x] Integración: al borrarse la cuenta desaparecen sus favoritos
- [x] E2E: un test por cada criterio de aceptación de arriba (5 de 5)
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

**Cerrada.**

- Unitarios: 204 pasan.
- Integración: 51 pasan.
- E2E: 55 pasan.
- Revisión de seguridad: sin hallazgos.

## Cómo se resolvió lo de la clave de servicio

Borrar de `auth.users` es una operación de administración, y la clave de servicio no
puede vivir en código alcanzable desde una página. La salida es
`public.borrar_mi_cuenta()`: una función `security definer` que corre con los
privilegios de su dueño pero **solo puede borrar a quien la llama**, porque el `where`
está atado a `auth.uid()` —que sale del JWT verificado— y la función no acepta
argumentos, así que no hay nada que manipular.

Dos detalles que la hacen segura y que es fácil pasar por alto:

- `set search_path = ''`. Sin eso, quien la llame puede anteponer un esquema propio a
  la ruta de búsqueda y hacer que `users` apunte a una tabla suya: es la forma clásica
  de convertir una función `security definer` en una escalada de privilegios.
- Los `revoke`. Postgres concede `EXECUTE` a `PUBLIC` por defecto al crear una función,
  así que sin revocarlo `anon` podría invocarla.

Ambos se comprobaron **contra la base de datos**, no solo leyendo el SQL: los permisos
efectivos son `authenticated`, `postgres` y `service_role`, y la configuración de la
función registra `search_path=""`. Y los tests de integración atacan: con la sesión de
A se intenta borrar a B, y B sigue ahí.

## Deuda que sigue abierta

- Exportar los datos antes de borrarlos (portabilidad, RGPD art. 20).
- El buzón `hola@gourses.com`, que la política todavía necesita para otras vías de
  contacto.
