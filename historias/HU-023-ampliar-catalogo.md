# HU-023 — Ampliar el catálogo

## Contexto

Fase 5 del roadmap, pero antes de añadir plataformas nuevas conviene exprimir las dos
que ya hay: **el catálogo tiene 425 cursos** (325 de Udemy, 101 de Coursera) y Udemy
sola publica cientos de miles. Con ese tamaño, la probabilidad de que alguien entre
buscando algo concreto y lo encuentre es baja, y sin eso no hay producto que valga.

No es una limitación técnica: son topes puestos a mano en la ingesta. Medido contra la
API real el 19 de agosto de 2026:

| Medida | Valor real |
|---|---|
| Categorías raíz | 13 |
| Categorías + subcategorías | **143** ámbitos |
| Ámbitos que se recorren hoy | 13 (subcategorías desactivadas) |
| `page_size` máximo | **50** (con 100 la API responde 400) |
| Cursos por ámbito | ~71 (tope de la unidad, no de la paginación) |
| Coste del detalle de precio | **0,45 s por curso** |
| Tope del job en el workflow | 30 min |

Dos consecuencias que marcan el diseño:

- **Subir páginas por ámbito no sirve**: cada unidad se agota sobre los 71 cursos. Lo
  que multiplica el catálogo es activar las subcategorías, de 13 a 143 ámbitos.
- **El cuello de botella es el detalle**, no el listado. El listado no trae precio, así
  que hay una petición por curso. A 0,45 s en serie, 5.000 cursos son **37 minutos**:
  más que el tope del job. Sin resolver eso, ampliar el catálogo solo consigue que la
  ingesta muera a medias todas las noches.

## Como visitante quiero que el buscador tenga catálogo suficiente para encontrar el curso que busco en vez de irme con las manos vacías

## Criterios de aceptación

- **Given** la ingesta de Udemy **When** se ejecuta con subcategorías activadas
  **Then** recorre los 143 ámbitos, no solo las 13 categorías raíz

- **Given** un curso que aparece en varios ámbitos **When** se ingiere **Then** se pide
  su detalle una sola vez, no una por ámbito

- **Given** la ingesta completa **When** se ejecuta **Then** termina dentro del tope del
  job, sin quedarse a medias

- **Given** que la API responde con un límite de peticiones (429) **When** ocurre
  durante la ingesta **Then** se reintenta con espera creciente en vez de perder ese
  curso

- **Given** una ejecución con más concurrencia **When** falla un curso suelto **Then**
  los demás se guardan igual, como hasta ahora

## Fuera de alcance

- Añadir plataformas nuevas: eso es la Fase 5 propiamente dicha.
- Traer el catálogo entero de Udemy. El objetivo es pasar de cientos a miles, no
  replicar su base de datos.
- Cambiar cómo se guardan o normalizan los cursos: el esquema no se toca.

## Cuidados

- **No maltratar la API.** La concurrencia va acotada y con espera creciente ante un
  429; el objetivo es acabar a tiempo, no ir lo más rápido posible. Un bloqueo de
  Udemy costaría la afiliación, que es de lo que vive el sitio.
- La deduplicación por curso ya existe y hay que conservarla: los ámbitos se solapan
  mucho, y sin ella la concurrencia multiplicaría las llamadas en vez de acelerarlas.
- Un curso que falla no puede tumbar la ingesta entera, como hasta ahora.
- Más cursos significa más filas de histórico de precios cada noche. Conviene mirar el
  crecimiento antes de dar por buena la cifra.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: la concurrencia respeta el tope y no repite cursos ya vistos
- [x] Unitarios: un 429 se reintenta con espera creciente; otros errores no
- [x] Unitarios: un curso que falla no impide que se guarden los demás
- [x] Integración: una ejecución acotada contra la API real guarda cursos de
      subcategorías
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

**Cerrada.**

- Unitarios: 257 pasan.
- Integración: 65 pasan.
- E2E: 64 pasan.
- Revisión de seguridad: sin hallazgos.

## Lo que se cambió, y por qué esos números

| Ajuste | Antes | Ahora |
|---|---|---|
| Subcategorías | desactivadas (13 ámbitos) | activadas (143 ámbitos) |
| `page_size` | 12 | 50 (máximo real: con 100 la API da 400) |
| Detalle de precio | en serie | concurrencia 6, con reintentos |
| Coursera | 1 página | 40 páginas |
| Tope del job | 30 min | 60 min |

Medido contra la API real: 0,59 s por curso en serie frente a **0,25 s con
concurrencia 6**, y ~59 cursos únicos por ámbito. Proyección: **de 425 a ~12.500
cursos** (8.500 de Udemy + 4.000 de Coursera) en unos 29 minutos, de ahí el margen
del doble en el tope.

Coursera sale casi gratis —4.000 cursos en 16 s— porque su catálogo no trae precio y
no hay una petición de detalle por curso. Es la misma carencia que impide compararlos
por precio en la web.

## El fallo que estuvo a punto de colarse

El reintento se puso primero envolviendo `fetchDetailTolerantly`. Esa función captura
el error por dentro y devuelve `null`, así que **el reintento nunca habría visto un
429**: no se habría ejecutado jamás y el job habría perdido precios en silencio,
pareciendo correcto. Se movió a envolver la llamada real, y hay un test que falla si
alguien lo devuelve a su sitio anterior.

También hubo dos tests propios mal planteados: uno daba por hecho que un detalle
fallido descarta el curso (no: se guarda sin precio y el fallo queda anotado), y otro
esperaba un error de forma donde el sistema tolera a propósito un curso mal formado.

## Sobre el crecimiento de la base de datos

Comprobado: el histórico de precios **solo escribe cuando el precio cambia** (HU-005),
no una fila por curso y noche. A 256 bytes por fila y 1,8 kB por curso, el catálogo
ampliado cabe de sobra en el plan gratuito de Supabase. Conviene volver a mirarlo
cuando haya varios meses de histórico.

## Deuda que sigue abierta

- La primera ejecución con el catálogo completo aún no se ha lanzado: los despliegues
  y la ingesta programada dependen de que se reanuden los créditos de Netlify el 9 de
  septiembre de 2026. En local ya funciona.
- Coursera sigue sin precio ni valoración, así que una parte del catálogo no se puede
  comparar en lo que más importa.
