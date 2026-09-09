import { GoogleGenAI, ApiError } from "@google/genai";
import { construirPrompt, limpiarResumen, type CursoParaResumir, type GeneradorDeResumen } from "./resumen-curso.ts";

// Adaptador real contra la API de Gemini (HU-030), separado de la lógica pura
// del prompt para poder probar esta última sin red ni clave — mismo criterio
// que separa fetch-catalog.ts de normalize.ts en la ingesta.
//
// Se eligió Gemini y no la API de Anthropic porque esta última no entra en
// ninguna suscripción existente y hay que pagarla aparte (aunque sea poco:
// unos 4-5 € por el catálogo entero con Haiku). Gemini tiene un nivel
// gratuito de verdad en modelos Flash, sin tarjeta.
//
// gemini-2.5-flash se retiró para cuentas nuevas (comprobado el 9 de
// septiembre de 2026: la API respondía 404 "no longer available to new
// users", indicando gemini-3.6-flash como sustituto). Sin esto el job fallaba
// en silencio en todos los cursos: la espera de ritmo se aplica antes de cada
// llamada aunque falle, así que con miles de candidatos el error solo se veía
// al cabo de horas, en el resumen final de fallidos.
//
// gemini-3.6-flash (probado ese mismo día) tiene una cuota gratuita de solo
// **20 peticiones al día por proyecto** (visible en el propio error 429:
// "GenerateRequestsPerDayPerProjectPerModel-FreeTier", limit 20) — inútil para
// un catálogo de miles de cursos. Se cambió a la variante "lite" de la misma
// generación: los modelos *-flash-lite vienen recibiendo cuotas diarias
// gratuitas bastante más altas que su "flash" completo hermano en todas las
// generaciones anteriores de Gemini, aunque Google no publica la cifra exacta
// por adelantado (solo aparece si se agota, en el mensaje del propio 429).
const MODELO_POR_DEFECTO = "gemini-3.5-flash-lite";

// Suficiente para 2-3 frases con margen; no es la tarea para dejarle escribir
// sin límite.
const MAX_TOKENS_SALIDA = 300;

// El nivel gratuito de los modelos Flash admitía del orden de 15 peticiones
// por minuto con gemini-2.5-flash (verificado en la documentación de Google
// AI Studio, 2026-08-25). Al migrar a gemini-3.6-flash (2026-09-09) la
// documentación pública ya no lista cifras concretas de RPM/RPD para el nivel
// gratuito —solo remite al panel de cada cuenta en aistudio.google.com—, así
// que se mantiene el mismo ritmo conservador en vez de arriesgar sin verificar
// el nuevo límite: a una petición cada 4,5 s salen ~13,3 al minuto. Va dentro
// del adaptador y no en la concurrencia del job para que el ritmo se respete
// pase lo que pase con la opción de concurrencia que se le pida.
const INTERVALO_MINIMO_MS = 4500;

function creaEsperaDeRitmo(intervaloMs: number): () => Promise<void> {
  let ultimaLlamada = 0;
  return async () => {
    const espera = ultimaLlamada + intervaloMs - Date.now();
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    ultimaLlamada = Date.now();
  };
}

export function creaGeneradorDeResumenGemini(
  apiKey: string,
  modelo: string = MODELO_POR_DEFECTO
): GeneradorDeResumen {
  const client = new GoogleGenAI({ apiKey });
  const esperarRitmo = creaEsperaDeRitmo(INTERVALO_MINIMO_MS);

  return async function generarResumen(curso: CursoParaResumir): Promise<string> {
    await esperarRitmo();

    let respuesta;
    try {
      respuesta = await client.models.generateContent({
        model: modelo,
        contents: construirPrompt(curso),
        config: { maxOutputTokens: MAX_TOKENS_SALIDA },
      });
    } catch (error) {
      // Se normaliza a un mensaje con el código de estado dentro, mismo
      // formato que ya usa la ingesta de Udemy: es lo que `esReintentable`
      // sabe leer para decidir si merece la pena reintentar. Un 429 aquí
      // puede ser la cuota diaria agotada, no solo el ritmo por minuto: si
      // se agota, este curso se anota en `fallidos` y el job sigue con el
      // resto; volver a lanzar el job al día siguiente recoge justo los que
      // faltaron, porque `necesitaResumen` no vuelve a pedir lo que ya tiene.
      const status = error instanceof ApiError ? error.status : undefined;
      const motivo = error instanceof Error ? error.message : String(error);
      throw new Error(`API de Gemini respondió ${status ?? "error"}: ${motivo}`);
    }

    const texto = respuesta.text;
    if (!texto || texto.trim().length === 0) {
      throw new Error("La API de Gemini no devolvió texto para este curso");
    }

    return limpiarResumen(texto);
  };
}
