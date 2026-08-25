import Anthropic from "@anthropic-ai/sdk";
import { construirPrompt, limpiarResumen, type CursoParaResumir, type GeneradorDeResumen } from "./resumen-curso.ts";

// Adaptador real contra la API de Anthropic (HU-030), separado de la lógica
// pura del prompt para poder probar esta última sin red ni clave — mismo
// criterio que separa fetch-catalog.ts de normalize.ts en la ingesta.
//
// Haiku 4.5: para resumir un texto corto que ya está delante, con
// instrucciones simples, un modelo mayor no se nota y sí se nota el coste a
// escala de 8.796 cursos.
const MODELO = "claude-haiku-4-5";

// Suficiente para 2-3 frases con margen; no es la tarea para dejarle
// escribir sin límite.
const MAX_TOKENS_SALIDA = 300;

export function creaGeneradorDeResumenAnthropic(apiKey: string): GeneradorDeResumen {
  const client = new Anthropic({ apiKey });

  return async function generarResumen(curso: CursoParaResumir): Promise<string> {
    let respuesta;
    try {
      respuesta = await client.messages.create({
        model: MODELO,
        max_tokens: MAX_TOKENS_SALIDA,
        messages: [{ role: "user", content: construirPrompt(curso) }],
      });
    } catch (error) {
      // Se normaliza a un mensaje con el código de estado dentro, mismo
      // formato que ya usa la ingesta de Udemy: es lo que `esReintentable`
      // sabe leer para decidir si merece la pena reintentar.
      const status = error instanceof Anthropic.APIError ? error.status : undefined;
      const motivo = error instanceof Error ? error.message : String(error);
      throw new Error(`API de Anthropic respondió ${status ?? "error"}: ${motivo}`);
    }

    const bloqueTexto = respuesta.content.find((b) => b.type === "text");
    if (!bloqueTexto || bloqueTexto.type !== "text" || bloqueTexto.text.trim().length === 0) {
      throw new Error("La API de Anthropic no devolvió texto para este curso");
    }

    return limpiarResumen(bloqueTexto.text);
  };
}
