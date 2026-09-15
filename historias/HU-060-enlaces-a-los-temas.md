# HU-060 — Enlazar las páginas de tema desde el resto del sitio

## Contexto

Fase 6, tráfico orgánico (2026-09-15). HU-058 crea las páginas `/cursos/<tema>` y las
anuncia en el sitemap, pero una página a la que no enlaza nada del propio sitio se
descubre tarde y Google la considera menos importante (se vio con las categorías en
HU-056: cinco solo se encontraban por el sitemap). Esta parte se separó de HU-058 para
poder cerrar aquella antes.

## Como visitante que explora el sitio quiero llegar a los temas desde donde estoy para encontrar cursos de lo que me interesa sin buscar

## Criterios de aceptación

- **Given** la portada **When** recorro sus enlaces **Then** hay una sección de temas que
  lleva a las páginas de tema que superan el umbral, y a ninguna que no lo supere
- **Given** la página de una categoría **When** recorro sus enlaces **Then** enlaza a los
  temas que superan el umbral y cuya mayoría de cursos en español es de esa categoría
- **Given** la ficha de un curso cuyo título pertenece a un tema que supera el umbral
  **When** la abro **Then** enlaza a la página de ese tema
- **Given** un tema que baja del umbral **When** se recorren portada, categorías y fichas
  **Then** ninguna enlaza a él

## Fuera de alcance

- Crear las páginas de tema, clasificar los cursos o el sitemap: HU-058.
- Menús desplegables o navegación nueva en la cabecera.

## Diseño

- Reutiliza de HU-058 la columna `temas`, la lista cerrada y la función que decide si un
  tema supera el umbral. El recuento por tema se calcula una vez y se comparte.
- La categoría «dueña» de cada tema se calcula con los datos (la categoría con más cursos
  en español del tema), no se fija a mano.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: categoría dueña de un tema (empates, tema sin cursos), temas enlazables
      según el umbral
- [x] E2E: un test por criterio de aceptación, salvo el del umbral (ver abajo)
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada` (2026-09-15)

### Cambio de diseño: una vista en vez de leer los cursos

Con lo que dejó HU-058, saber qué temas superan el umbral exigía leer los ~4.400 cursos
con tema en cinco peticiones (PostgREST devuelve 1.000 filas como mucho). Aceptable en el
sitemap, que se regenera una vez al día, pero no en la portada en cada visita.

La migración `0012` crea la vista `temas_por_categoria`, que agrupa en la base: 149 filas
en ~80 ms por PostgREST. La usan la portada, las categorías, la ficha y el sitemap.

- `security_invoker = true`: la vista se consulta con los permisos de quien pregunta y
  respeta la RLS de `courses`.
- Lleva escrito el 50 de `RESENAS_MINIMAS`. Un test de integración compara la vista con un
  recuento en SQL hecho con la constante de TypeScript, en los 28 temas, para que no se
  desincronicen en silencio.
- **Hallazgo al aplicarla**: PostgREST vio sola la columna nueva de HU-058, pero no la
  vista («Could not find the table … in the schema cache»). La migración termina con
  `notify pgrst, 'reload schema'`.

### Lo construido

- **Portada**: sección «Temas populares» con los temas que superan el umbral (28 en
  desarrollo).
- **Categoría**: «Temas en español» con los temas de los que es dueña. Desarrollo enlaza a
  Python, desarrollo de videojuegos, SQL, Android y desarrollo web.
- **Ficha**: «Más cursos en español de» con los temas del curso que tienen página.
- **Empates**: meditación y mindfulness tiene 14 cursos en desarrollo personal y 14 en
  salud y bienestar, y se enlaza desde las dos.
- Si la lectura del resumen falla, cada página sale sin su sección, nunca rota.

### El criterio del umbral no tiene e2e

«Un tema que baja del umbral no se enlaza» no se puede provocar con datos reales, por lo
mismo que en HU-058: en desarrollo los 28 temas lo superan. Lo cubren los unitarios de
`temasEnlazables` y `temasDeCategoria`, y el e2e de portada comprueba que los temas
enlazados son exactamente los que anuncia el sitemap.

### Resultado de los tests

- Unitarios (`npm test`): 707 pasan.
- Integración (`npm run test:integration`): 135 pasan, 1 nuevo (vista frente a TypeScript).
- E2E (`npx playwright test`): 234 pasan, 3 nuevos, en 2,4 min.

### En producción

Aplicar `0012` en Supabase Cloud, después de `0011` y del relleno de temas de HU-058.

### Revisión de seguridad

Sin hallazgos críticos ni altos:

- **Vista**: `security_invoker`, solo `select` para `anon` y `authenticated`, y solo expone
  recuentos de datos que ya son públicos.
- **Temas de la ficha**: se filtran con `esTema` antes de usarse.
- **Enlaces**: se construyen con identificadores de la lista cerrada y nombres fijos.
- **La exportación de datos personales no cambia**: copia los campos del curso uno a uno y
  no incluye `temas`.
