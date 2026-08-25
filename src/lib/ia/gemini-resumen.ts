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
const MODELO_POR_DEFECTO = "gemini-2.5-flash";

// Suficiente para 2-3 frases con margen; no es la tarea para dejarle escribir
// sin límite.
const MAX_TOKENS_SALIDA = 300;

// El nivel gratuito de los modelos Flash admite del orden de 15 peticiones
// por minuto (verificado en la documentación de Google AI Studio,
// 2026-08-25). Se deja un margen amplio: a una petición cada 4,5 s salen
// ~13,3 al minuto, por debajo del límite aunque la cifra exacta varíe algo
// por cuenta o región. Va dentro del adaptador y no en la concurrencia del
// job para que el ritmo se respete pase lo que pase con la opción de
// concurrencia que se le pida.
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
