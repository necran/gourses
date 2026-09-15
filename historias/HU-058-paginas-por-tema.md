# HU-058 — Páginas por tema en español

## Contexto

Fase 6, estrategia de tráfico orgánico (2026-09-15). HU-046 dio una página a cada una de
las once categorías amplias, y HU-056 dejó el SEO técnico en orden, pero la gente no
busca «cursos de Desarrollo»: busca **«cursos de Python en español»**, «curso de Excel»,
«mejores cursos de marketing digital». Hoy no hay ninguna página que responda a eso:
`/buscar?keyword=python` es `noindex` desde HU-056, a propósito.

El problema de fondo es el contenido. Las fichas son casi todas la descripción copiada
de la plataforma, en inglés en su mayoría, y **ningún curso en español de Udemy tiene
todavía resumen propio en la base de desarrollo** (0 de 3.540). Lo único que este sitio
puede ofrecer que no tenga ya Udemy es lo que se construye **con datos del propio
catálogo**: cuántos cursos hay, de qué plataformas, valoraciones, duración, precio.

Y aquí está el riesgo que manda en toda la historia. HU-030 ya lo explicó: Google
persigue el *scaled content abuse*, páginas finas generadas en masa con enlaces de
afiliado detrás. Doscientas páginas «Cursos de X» con tres cursos y una frase de
plantilla serían exactamente eso, y pueden arrastrar al sitio entero. **Una página por
tema solo existe si tiene cursos suficientes y datos propios que contar.**

### Lo que dicen los datos (base de desarrollo, 2026-09-15)

Todas las cifras son de la base de desarrollo del NAS. **Producción es otra base**
(Supabase Cloud, ingerida cada noche) y sus números serán parecidos pero no iguales; son
orientativos y el diseño no puede depender de que una cifra concreta se mantenga.

**Catálogo.** Udemy: 7.854 cursos en inglés y 3.540 en español. Coursera: 3.321 en
inglés, 260 en español y el resto en otros idiomas.

**Precio.** En Udemy en español, **2.928 de los 3.370 cursos con precio cuestan 14,99 €**
(el 87 %); 170 no tienen precio. En todo Udemy, 10.162 de 11.110. La mediana de precio
sale 14,99 € en prácticamente todos los temas, así que **el precio no distingue un tema
de otro**. Además:

- **No existe ningún curso con `price_amount = 0`.** Ni uno. Coursera no trae precio
  (`null` en los 4.000), que significa «no lo sabemos», no «gratis».
  → Las páginas **no pueden prometer «cursos gratis»**, aunque sea una búsqueda muy
  frecuente. Ver riesgos.
- Coursera tampoco trae valoración (0 con `rating`), así que la valoración media de un
  tema es solo de Udemy y hay que decirlo.

**Buscar solo en el título.** Buscando también en la descripción el recuento se dispara
con cursos que solo mencionan el tema de pasada: Python pasa de 54 a 102 cursos en
español; Excel, de 50 a 183. Para una página que dice «cursos de Excel», el título es el
criterio correcto.

**Palabras frecuentes.** Se contaron las palabras de los 3.800 títulos en español para
proponer temas desde los datos, no desde la intuición. Tras «curso», «cero», «completo»…
aparecen *ia* (181), *python* (57), *excel* (53), *marketing* (60), *trading* (48),
*chatgpt* (43), *sap* (39), *power bi*, *fotografía*, *photoshop*, *canva*, *seo*,
*wordpress*, *blender*, *autocad*, *revit*, *unity*, *n8n*…

**Recuento por tema** (solo título, con límites de palabra; «es» = cursos con
`language = 'es'`; «≥50 reseñas» = cursos en español con al menos 50 reseñas; duración
mediana de los cursos en español):

| Tema (patrón resumido) | En español | Total | Udemy / Coursera (es) | Valoración media (Udemy es) | Duración mediana (es) | ≥50 reseñas (es) |
|---|---|---|---|---|---|---|
| Inteligencia artificial (ia, ai, inteligencia artificial, generativa, chatgpt, openai, claude, gemini, copilot, llm, prompt) | 276 | 1.551 | — | — | — | — |
| Marketing digital (marketing digital, seo, google/meta/facebook ads, redes sociales, social media, community manager, instagram, tiktok) | 104 | 365 | — | — | — | — |
| Python | 54 | 230 | 51 / 3 | 4,64 | 25,5 h | 46 |
| Excel | 50 | 200 | 48 / 2 | 4,60 | 10,8 h | 39 |
| Trading (trading, forex) | 48 | 125 | 48 / 0 | 4,57 | 7,8 h | 30 |
| Desarrollo de videojuegos (videojuego/s, game dev, unreal, godot) | 47 | 138 | 44 / 3 | 4,64 | 18 h | 27 |
| Fotografía | 43 | 202 | 43 / 0 | 4,53 | 3 h | 32 |
| SAP (excluyendo «SAP-C0x», certificación de AWS) | 38 | 143 | — | 4,49 | 5 h | 28 |
| Liderazgo | 37 | 132 | 31 / 6 | 4,62 | 4 h | 23 |
| Gestión de proyectos (gestión de proyectos, project management, pmp, scrum, agile, ágil) | 37 | 153 | 30 / 7 | 4,54 | 7 h | 27 |
| SQL (sql, mysql, postgresql, postgres, t-sql, pl/sql) | 36 | 154 | 35 / 1 | 4,62 | 12,3 h | 32 |
| Criptomonedas (criptomoneda/s, crypto…, bitcoin, blockchain) | 32 | 91 | 31 / 1 | 4,47 | 4 h | 16 |
| Yoga | 28 | 77 | 28 / 0 | 4,63 | 5,5 h | 11 |
| Meditación y mindfulness | 28 | 83 | 27 / 1 | 4,61 | 4 h | 12 |
| Contabilidad | 26 | 130 | 25 / 1 | 4,52 | 5,5 h | 19 |
| Ciencia de datos (data science, ciencia de datos, análisis de datos, data analy…) | 26 | 172 | 23 / 3 | 4,61 | 16 h | 20 |
| Edición de vídeo (premiere, after effects, davinci, edición de vídeo, video editing) | 26 | 78 | 26 / 0 | 4,56 | 7,8 h | 14 |
| Producción musical (producción musical, music production, ableton, fl studio) | 26 | 58 | 24 / 2 | 4,65 | 8 h | 16 |
| Photoshop | 26 | 76 | 26 / 0 | 4,56 | 8,3 h | 10 |
| Psicología | 25 | 104 | 24 / 1 | 4,61 | 7 h | 11 |
| Nutrición | 25 | 53 | 24 / 1 | 4,48 | 5 h | 12 |
| Ciberseguridad (ciberseguridad, cybersecurity, hacking, pentesting) | 24 | 99 | 20 / 4 | 4,60 | 9,5 h | 18 |
| Power BI | 24 | 67 | 24 / 0 | 4,62 | 11,8 h | 21 |
| Dibujo e ilustración (dibujo, drawing, ilustración) | 22 | 64 | 22 / 0 | 4,54 | 8,5 h | 14 |
| Android | 21 | 62 | 20 / 1 | 4,63 | 26 h | 16 |
| UX/UI | 21 | 98 | 20 / 1 | 4,58 | 6,8 h | 10 |
| Guitarra | 20 | 50 | 20 / 0 | 4,64 | 5,5 h | 13 |

(Los dos temas amplios se midieron solo en recuento. Los desgloses de las demás filas son
de la versión del patrón indicada; SAP se midió primero sin la exclusión —39 en español,
144 en total— y la exclusión quita un curso.)

**Temas que se miraron y no llegan**, aunque sean búsquedas muy populares:

| Tema | En español | Total |
|---|---|---|
| Google Sheets | 14 | 30 |
| Machine learning / deep learning | 14 | 104 |
| Figma | 13 | 47 |
| C# / .NET | 13 | 38 |
| Git / GitHub | 13 | 46 |
| Primeros auxilios | 13 | 35 |
| **Java** | 12 | 91 |
| Illustrator | 11 | 28 |
| HTML / CSS | 11 | 41 |
| AWS | 10 | 97 |
| Piano | 10 | 32 |
| Oratoria | 10 | 24 |
| R | 10 | 33 |
| Flutter | 9 | 31 |
| Docker / Kubernetes | 7 | 51 |
| **Inglés** | 7 | 73 |
| **React** | 7 | 56 |
| PHP | 6 | 10 |
| Angular | 5 | 22 |
| TypeScript | 4 | 20 |
| **JavaScript** | **3** | 35 |
| Go / Golang | 2 | 45 |
| Node.js | 2 | 19 |

JavaScript, React e inglés —búsquedas enormes— tienen entre 3 y 7 cursos en español con
el tema en el título. Una página «Cursos de JavaScript en español» con 3 cursos sería
justo la página fina que hay que evitar. Agrupadas como «desarrollo web» (desarrollo web,
diseño web, html, css, javascript, react, angular, node.js, php, laravel, django) suman
43 en español y 213 en total, pero es un tema difuso; queda como decisión (ver abajo).

### Falsos positivos comprobados

Se sacaron muestras de títulos reales de cada tema dudoso:

- **«R»** mete cursos ajenos: «Entrevista Laboral por Competencias: Método S.T.A.R.» y
  «SAP: Supply Chain Logistics in R/3». Con 10 cursos en español no llega de todos
  modos.
- **«Go»** es inutilizable como palabra suelta: «Go from Zero to Hero», «Go To Market
  Strategy», «Go, Baduk, Weiqi» (el juego de mesa). Solo «Golang» o «Go (Golang)» es
  fiable; 2 cursos en español.
- **«Java»** con límite de palabra **no** mete JavaScript (en la muestra solo salen Java,
  Spring Boot y Selenium con Java). Sin límite de palabra sí lo haría.
- **«SAP»** mete «AWS Solutions Architect Professional: Certificación SAP-C02». Se
  excluye `SAP-C0x`.
- **«IA»** con límite de palabra no casa dentro de otras palabras («media», «historia»…)
  en ninguna muestra; todos los títulos eran de inteligencia artificial.
- **«Ventas»** mete tangenciales: «Amazon Dropshipping… Super Ventas», «Odoo… Módulos de
  Ventas» (3 de 40 en español con esas palabras). Dudoso como tema.
- **«Finanzas»** con *financiero/a* se come «Contabilidad Financiera» y «Evaluación
  financiera de proyectos»: 61 en español, pero mezcla finanzas personales (12 en
  español) con finanzas corporativas. Dudoso.
- **«ISO»** junta normas sin relación (9001 calidad, 27001 seguridad, 13485 dispositivos
  médicos, 14067 huella de carbono): 27 en español, pero quien busca «ISO 27001» no
  quiere «ISO 45001».
- **«Excel»** y **«Python»** traen cursos donde el tema es la herramienta de otro
  («Trading con Python y MetaTrader 5», «Finanzas personales… (Excel)»). Se aceptan: el
  curso sí usa la herramienta.
- **Límites de palabra y acentos**: en Postgres `\m`/`\M` tratan bien «inglés» o
  «fotografía». **En JavaScript `\b` no**: considera la «é» un separador, así que
  `/\bingl[eé]s\b/` falla con «Inglés». Si la clasificación se hace en TypeScript (lo
  que propone el diseño), los límites tienen que ser Unicode (`(?<![\p{L}\p{N}])` …
  `(?![\p{L}\p{N}])` con la bandera `u`), no `\b`.

## Como alguien que busca en Google «cursos de Python en español» quiero llegar a una página de Gourses dedicada a ese tema, con los cursos en español y datos para elegir entre ellos, para decidir sin revisar curso por curso en cada plataforma

## Criterios de aceptación

- **Given** un tema de la lista cerrada con cursos suficientes **When** abro
  `/cursos/<tema>` **Then** veo un titular «Cursos de <Tema> en español» y el listado de
  sus cursos en español
- **Given** esa página **When** leo el texto de presentación **Then** incluye datos del
  propio catálogo —cuántos cursos hay en español y cuántos en total, de qué plataformas,
  la valoración media indicando que es de Udemy y la duración típica—, y esas cifras
  coinciden con los cursos listados
- **Given** esa página **When** miro sus metadatos **Then** tiene título y descripción
  propios (la descripción con el número de cursos, por debajo de 160 caracteres), es
  canónica de sí misma y es indexable
- **Given** una página de tema **When** busco la palabra «gratis» en el título, la
  descripción o el texto **Then** no aparece
- **Given** un curso cuyo título contiene una palabra parecida pero no el tema (p. ej. un
  curso de JavaScript en el tema Java, o «SAP-C02» de AWS en SAP) **When** abro la
  página del tema **Then** ese curso no está en el listado
- **Given** un tema con más cursos de los que caben **When** paso de página **Then** la
  página siguiente tiene su propia dirección y es canónica de sí misma
- **Given** un tema de la lista que en esta base tiene menos cursos en español que el
  umbral **When** abro su página **Then** responde con normalidad, dice cuántos cursos
  hay, se marca `noindex, follow` y no aparece en el sitemap ni en los enlaces internos
- **Given** un identificador que no está en la lista cerrada de temas **When** lo abro
  **Then** veo la página de «no encontrado» en castellano
- **Given** una página de tema **When** quiero ver también cursos en otros idiomas o
  afinar **Then** hay un enlace al buscador con esa palabra clave
- **Given** la portada **When** recorro sus enlaces **Then** hay una sección de temas que
  lleva a las páginas de tema que superan el umbral
- **Given** la página de una categoría **When** recorro sus enlaces **Then** enlaza a los
  temas que superan el umbral y cuya mayoría de cursos en español es de esa categoría
- **Given** la ficha de un curso cuyo título pertenece a un tema que supera el umbral
  **When** la abro **Then** enlaza a la página de ese tema
- **Given** el sitemap **When** lo lee un buscador **Then** incluye los temas que superan
  el umbral y ninguno que no lo supere
- **Given** una página de tema **When** se leen sus datos estructurados **Then** declara
  sus migas de pan (`BreadcrumbList`) con direcciones absolutas

## Fuera de alcance

- **Temas por debajo del umbral**, aunque sean búsquedas populares (JavaScript, React,
  inglés, Java, AWS). Se añaden cuando el catálogo en español crezca, no antes.
- **«Cursos gratis».** No hay ningún curso a precio 0 en la base, y Coursera sin precio
  no es gratis. Una página que lo prometiera mentiría.
- **«Los mejores cursos de X» como ranking editorial.** Se pueden ordenar por reseñas o
  valoración, que son datos; declarar cuál es «el mejor» es una opinión que no se
  sostiene con esos datos.
- **Textos escritos a mano por tema.** Todo el texto se compone con datos. Redactar
  treinta textos es trabajo editorial.
- **Páginas de tema en inglés** o cruzadas con precio, nivel o plataforma
  («cursos de Python para principiantes»). Multiplicarían páginas finas.
- **Resúmenes con IA** (HU-030/HU-052/HU-053): si llegan, las fichas enlazadas mejoran,
  pero esta historia no depende de ellos.
- **Datos estructurados de listado** (`ItemList`): mismo criterio que HU-046.
- **Cambiar la búsqueda por palabra clave** de `/buscar` (título o descripción, HU-057).

## Diseño

### Ruta: `/cursos/[tema]`

`/cursos/python`, `/cursos/excel`, `/cursos/inteligencia-artificial`. Motivos:

- Se lee como la búsqueda («cursos python») y es corta; el «en español» va en el título
  y el titular, no en la dirección, que se queda estable si algún día el sitio tuviera
  otro idioma.
- No se mezcla con `/categoria/[slug]`: una categoría es la taxonomía de la plataforma
  (once, cerrada); un tema es una herramienta o habilidad que atraviesa categorías
  (Python cae en *desarrollo* 31, *negocios* 15, *humanidades* 3, *IT* 3… en español; IA,
  en siete categorías).
- **Cuidado**: se parece a `/curso/[id]` (singular). No chocan —son segmentos
  distintos—, pero conviene tenerlo presente al escribir enlaces y tests. Alternativa si
  se prefiere evitar la confusión: `/temas/python`, que lee peor como búsqueda.

### Lista cerrada de temas

Un módulo `src/lib/courses/temas.ts` con la lista, igual que `COURSE_CATEGORIES`: cada
tema tiene identificador, nombre para mostrar («Power BI», «Inteligencia artificial») y
sus patrones de título (inclusión y, si hace falta, exclusión). **Nada de temas
generados automáticamente** desde las palabras frecuentes: la lista la decide una
persona, con los números de la tabla de arriba.

Propuesta inicial (27 temas, todos con ≥ 20 cursos en español y ≥ 10 con al menos 50
reseñas en desarrollo): inteligencia artificial, marketing digital, Python, Excel,
trading, desarrollo de videojuegos, fotografía, SAP, liderazgo, gestión de proyectos,
SQL, criptomonedas, yoga, meditación y mindfulness, contabilidad, ciencia de datos,
edición de vídeo, producción musical, Photoshop, psicología, nutrición, ciberseguridad,
Power BI, dibujo e ilustración, Android, UX/UI y guitarra.

Fusiones deliberadas, para no tener dos páginas compitiendo por la misma búsqueda:

- **SEO y redes sociales dentro de marketing digital.** «Marketing» a secas (59 en
  español) mezcla marketing digital con marketing financiero o de marca; el tema es el
  digital, ampliado.
- **ChatGPT dentro de inteligencia artificial.** De los 48 cursos en español con ChatGPT
  u OpenAI en el título, 28 ya nombran la IA; separarlos crearía dos páginas casi
  iguales (ver decisiones).

Se quedan fuera de la primera lista, aunque superen 20 en español:

- **Canva** (20 en español): la mitad son de Coursera (10) y solo 1 tiene ≥ 50 reseñas.
- **WordPress** (21): solo 7 con ≥ 50 reseñas.
- **ISO** (27), **finanzas** (61), **ventas** (40), **Amazon** (20, FBA y KDP) y
  **Arduino/PLC** (21, mezcla electrónica aficionada con automatización industrial):
  temas heterogéneos o con falsos positivos. Ver decisiones.

### Umbral

Una página de tema es indexable si, **en la base en la que se sirve**, cumple las dos:

1. **Al menos 20 cursos en español.**
2. **Al menos 10 de ellos con 50 reseñas o más.**

Por qué estos números:

- **20** es donde el corte separa temas con catálogo de temas testimoniales. Por encima
  quedan 38 temas medidos; por debajo, a partir de 14 (Google Sheets, machine
  learning), se cae enseguida a 13, 12, 10… y a 3–7 en los lenguajes web. Con 25 se
  quedarían 27 temas y caerían Power BI (24), ciberseguridad (24) o dibujo (22), que
  tienen buen catálogo; con 30, 17. Con 15 entrarían temas de 15–19 cursos cuya
  «valoración media» y «duración típica» dependen de un puñado de cursos.
- **La segunda condición** existe porque 20 cursos sin nadie que los haya valorado no
  aportan: la valoración media que da contenido propio a la página sale de ahí. En
  desarrollo la mediana de reseñas de un curso de Udemy en español es 92, así que 50 no
  es exigente; aun así elimina Canva (1) y WordPress (7).
- **Por debajo del umbral hay listado, no página indexable** (ver riesgos).

El umbral es una constante en código con tests, no un número disperso por la página.

### Cómo se clasifica un curso: en la ingesta, no en cada visita

Se propone una función pura `temasDelTitulo(titulo): TemaId[]` en TypeScript, con
límites de palabra Unicode (no `\b`, ver arriba), probada con **títulos reales** sacados
en esta investigación, incluidos los falsos positivos.

- **La ingesta** la aplica al guardar cada curso y escribe una columna `temas text[]`
  (migración con índice GIN), más una pasada única para los cursos ya guardados.
- **La web** filtra con `temas @> {python}` y `language = 'es'`: una consulta indexada,
  lejos del `statement_timeout` de 3 s del rol `anon` (HU-056/HU-057).
- Así la regla que decide si un curso es «de Python» vive en un solo sitio y se prueba
  sin base de datos, y la web nunca evalúa expresiones regulares sobre 15.000 títulos
  por visita.

Alternativa más barata de implementar: filtrar en la consulta con una expresión regular
de Postgres (`imatch` en PostgREST). La consulta que midió los 72 patrones sobre toda la
tabla tardó 520 ms en desarrollo, así que por tema es viable, pero los patrones de
Postgres no se pueden probar con Vitest tal cual, y habría dos dialectos de regex (el de
Postgres y el de las pruebas). Queda como decisión.

### Qué lleva cada página

- **Titular y título**: «Cursos de Python en español», igual en `<h1>` y en la pestaña
  (misma costumbre que HU-046).
- **Texto de presentación compuesto con datos**, calculado en una función pura a partir
  de los cursos del tema, no con frases de relleno. Por ejemplo: cuántos cursos hay en
  español y cuántos en total en el catálogo; cuántos de Udemy y cuántos de Coursera;
  valoración media («de los cursos de Udemy; Coursera no publica valoración»); duración
  mediana y rango; reparto por nivel; precio **«desde»** y el precio más habitual, con la
  advertencia de que es el de la última actualización. Sin «gratis». Si un dato no
  existe para el tema (p. ej. ninguna duración), la frase no aparece, en vez de decir
  «0 h».
- **Los más reseñados**: los tres cursos con más reseñas, como bloque aparte del
  listado, porque es la forma honrada de responder a «mejores cursos de X».
- **Listado** de los cursos en español con la paginación de HU-025 y la tarjeta de
  siempre.
- **Enlace al buscador**: «Ver también cursos en otros idiomas» →
  `/buscar?keyword=<nombre>`. Sin prometer una cifra: el buscador busca en título y
  descripción, así que sus recuentos no coinciden con los del tema.
- **Metadatos** con las costumbres de `categoria-seo.ts`: descripción < 160 caracteres
  con el número de cursos, canónica propia (con `?pagina=N` a partir de la 2, como
  HU-056), `openGraph` con `OPEN_GRAPH_SITIO`.
- **Datos estructurados**: `BreadcrumbList` (Inicio › Cursos de Python) con las
  funciones de `seo-sitio.ts` y `serializeStructuredData`.

### Relación con el resto del sitio

- **Categorías**: se quedan igual. Cada categoría enlaza a los temas cuya mayoría de
  cursos en español es suya (Python → desarrollo; Excel → negocios, 25 frente a 19 de
  productividad). La relación se calcula con los datos, no se fija a mano.
- **`/buscar`**: sigue `noindex` con palabra clave (HU-056), así que no compite con la
  página de tema en Google.
- **Portada**: sección «Temas populares» con los temas que superan el umbral.
- **Ficha**: enlace a los temas del curso que superan el umbral.
- **Sitemap**: añade los temas que superan el umbral. A diferencia de las categorías,
  **depende de leer el catálogo**, así que si esa lectura falla, no se anuncian (mejor
  omitirlos un día que anunciar páginas `noindex`).

## Riesgos

- **Contenido fino / *scaled content abuse*.** Mitigación: lista cerrada y corta,
  umbral doble, texto hecho de datos del catálogo y no de plantilla vacía, sin páginas
  cruzadas. Si Search Console marca las páginas como «rastreadas, no indexadas» en
  masa, se reduce la lista, no se añade texto de relleno.
- **Canibalización con las categorías.** Las búsquedas son distintas («cursos de
  desarrollo» frente a «cursos de Python») y los títulos también. El tema de
  inteligencia artificial y la categoría *datos-e-ia* son los que más se parecen; se
  vigila en Search Console.
- **Canibalización entre temas.** IA/ChatGPT y marketing digital/SEO/redes sociales, por
  eso se fusionan. Python y ciencia de datos se solapan en parte, pero responden a
  búsquedas distintas.
- **Temas que caen por debajo del umbral en producción.** Los números son de
  desarrollo; en producción guitarra (20), UX/UI (21) o Android (21) pueden quedarse
  cortos, y cualquier tema puede bajar tras una ingesta. Lo que pasa entonces:
  - la página **sigue respondiendo 200** con sus cursos y el recuento real, marcada
    `noindex, follow`, y sale del sitemap y de los enlaces internos;
  - **no es un 404**: el identificador es válido (está en la lista), y un 404 que
    aparece y desaparece según la ingesta de cada noche confunde más a Google que un
    `noindex` estable. Mismo criterio que HU-046: «una categoría vacía no es un error»;
  - el 404 queda solo para identificadores que no están en la lista.
  - Un tema justo en el borde podría alternar entre indexable y no indexable cada
    noche. Si pasa, se sube o se quita el tema de la lista; no se añade una histéresis
    por adelantado.
- **Precio poco informativo.** El 87 % de Udemy en español está a 14,99 €; la página no
  debe presumir de «comparar precios» en un tema donde todos cuestan igual.
- **Búsquedas que no se pueden servir.** «Curso de Excel gratis» o «cursos de JavaScript
  en español» traen tráfico, pero el catálogo no tiene cursos a precio 0 ni JavaScript
  en español suficiente. Mejor no posicionar que decepcionar.
- **Coste por visita.** La descripción, el texto y el listado necesitan los cursos del
  tema: en el tema más grande son 276 en español. Se calcula con una lectura y se
  revalida como las categorías; si pesa, se cachea el resumen por tema.

## Decisiones tomadas (2026-09-15)

1. **Ruta**: `/cursos/<tema>` (decisión del usuario).
2. **Clasificación**: columna `temas` escrita en la ingesta (decisión del usuario), con
   relleno inicial también en producción.
3. **Umbral**: 20 cursos en español y 10 de ellos con ≥ 50 reseñas. Es una constante;
   se endurece en un minuto si hiciera falta.
4. **Temas dudosos** (el usuario delegó en el criterio técnico lo no indicado):
   - **ChatGPT, dentro de inteligencia artificial** (decisión del usuario).
   - **Desarrollo web agrupado** —desarrollo y diseño web, HTML, CSS, JavaScript, React,
     Angular, Node.js, PHP, Laravel, Django— en lugar de JavaScript y React sueltos
     (decisión del usuario). Medido antes de incluirlo: **43 en español, 198 en total,
     23 en español con ≥ 50 reseñas**, valoración media 4,65; la muestra de títulos es
     del tema (PHP, CSS, Tailwind, JavaScript, diseño web con Figma).
   - **Finanzas, ventas, ISO, Amazon y Arduino/PLC, fuera**: mezclan cursos que solo
     tocan el tema de pasada o normas sin relación. Una página con cursos que no encajan
     es peor que no tenerla.
   - **«Growth hacking» no es ciberseguridad**: el patrón «hacking» lo metía (visto al
     escribir los patrones); se excluye.

Lista resultante: **28 temas** (los 27 propuestos más desarrollo web).

## División de la historia

Para poder probarla y cerrarla por partes, los enlaces internos (portada, categorías,
fichas) pasan a **HU-060**. Esta historia se queda con la clasificación, las páginas de
tema, el sitemap y sus datos estructurados. Los criterios de portada, categoría y ficha
de arriba se cumplen en HU-060, no aquí.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: `temasDelTitulo` con títulos reales —incluidos acentos («Inglés»,
      «Fotografía»), mayúsculas, y los falsos positivos de esta investigación (Java frente
      a JavaScript, «SAP-C02», «Método S.T.A.R.», «Go from Zero»)—; umbral (justo por
      debajo, justo en el borde, sin reseñas); texto de presentación (sin «gratis»,
      frases omitidas cuando falta el dato, valoración solo de Udemy, formato de números
      en español); título, descripción < 160 caracteres, canónica con y sin página;
      validación del identificador (inventado, mayúsculas, vacío, inyección)
- [x] Integración: la ingesta escribe y recalcula los temas (base de test); la lectura de
      un tema por PostgREST con filas `zzz-hu058-test-` sembradas y borradas (excepción
      de HU-007). El caso «por debajo del umbral» se cubre en unitarios (ver abajo)
- [x] E2E: un test por criterio de aceptación de esta historia, salvo el del umbral
      (ver abajo); los de portada, categoría y ficha pasaron a HU-060
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada` (2026-09-15)

### Lo construido

- `src/lib/courses/temas.ts`: los 28 temas, `temasDelTitulo` con límites de palabra
  Unicode, `nombreEnFrase` (minúscula para nombres comunes: «cursos de inteligencia
  artificial», pero «de Python») y el umbral.
- Migración `0011`: columna `temas text[]` con índice GIN.
- La ingesta (`postgres-course-store.ts`) escribe los temas en cada inserción y
  actualización, así que si cambia el título cambian con él.
- `scripts/clasificar-temas.mjs` (`npm run clasificar:temas`): relleno idempotente de los
  cursos existentes, con informe por tema. En desarrollo revisó 15.395 cursos en 15 s,
  asignó temas a 4.432, y **los 28 superan el umbral**.
- `src/lib/courses/temas-datos.ts`: lectura por tema, recuentos, resumen y texto de
  presentación, todo con datos.
- `/cursos/[tema]` con «no encontrado» propio, «Los más reseñados», paginación de 50,
  canónica propia, `noindex` bajo el umbral, migas de pan, y el sitemap con los temas que
  superan el umbral.

Ejemplo real (`/cursos/python`): «Hay 54 cursos de Python en español (230 contando todos
los idiomas): 51 de Udemy y 3 de Coursera. Los de Udemy tienen una valoración media de 4,6
sobre 5; Coursera no publica valoraciones. La duración típica ronda 25,5 h. El precio más
habitual es 14,99 €, según la última actualización del catálogo.»

### El criterio del umbral no tiene e2e, y por qué

«Un tema por debajo del umbral responde, se marca `noindex, follow` y sale del sitemap»
no se puede provocar en un e2e con datos reales: en desarrollo los 28 temas superan el
umbral, y bajar uno exigiría borrar o cambiar cursos de la base compartida mientras
corren otras pruebas, lo que rompería esas pruebas. Se cubre con:

- unitarios de `superaUmbral` (justo en el borde, uno menos, muchos cursos sin reseñas);
- unitarios de `agregarRecuentos`, que es lo que decide qué temas entran en el sitemap;
- el e2e comprueba el lado contrario: todas las páginas que anuncia el sitemap son
  indexables.

Si algún día un tema baja del umbral en desarrollo, se añade el e2e con ese tema.

### Hallazgos al construir

- **Nombres comunes con mayúscula en mitad de frase** («Cursos de Inteligencia
  artificial»): se vio al probar la página en vivo; de ahí `nombreEnFrase`.
- **«1542» sin punto de miles**: `toLocaleString("es-ES")` no agrupa los números de
  cuatro cifras; se usa `conSeparadorDeMiles`, como el resto del sitio.
- **Falso positivo no detectado en la investigación**: «hacking» metía «growth hacking»
  en ciberseguridad; se excluye (ciberseguridad pasa de 24 a 23 en español).
- UX/UI da 107 cursos en total frente a los 98 medidos por el agente; se revisó una
  muestra de 20 títulos y todos eran del tema.

### Resultado de los tests

- Unitarios (`npm test`): 702 pasan, 53 nuevos.
- Integración (`npm run test:integration`): 134 pasan, 4 nuevos.
- E2E (`npx playwright test`): 231 pasan, 10 nuevos, en 2,1 min.

### En producción

1. Aplicar `0011` en Supabase Cloud (junto con `0009` y `0010`).
2. Ejecutar `npm run clasificar:temas` contra la base de producción, una vez, y revisar
   su informe: los recuentos serán distintos de los de desarrollo.
3. A partir de ahí, la ingesta diaria mantiene los temas.

### Revisión de seguridad

Sin hallazgos críticos ni altos:

- **Identificador del tema**: se valida con `esTema` antes de cualquier consulta, con
  `Object.hasOwn` (rechaza `constructor`, `__proto__`…; comprobado) y sin normalizar
  mayúsculas. Un valor fuera de la lista da 404 y no llega a la base.
- **Consultas**: supabase-js con el tema como valor, nunca como texto de filtro; el
  script y la ingesta, con parámetros de `pg`.
- **Página**: `pagina` pasa por `parseCourseSearchFilters`; las migas de pan por
  `serializeStructuredData`; la palabra clave del enlace al buscador, por
  `encodeURIComponent`.
- **Texto de presentación**: solo cifras calculadas y nombres de la lista cerrada; los
  títulos de terceros se pintan como texto (React escapa).
