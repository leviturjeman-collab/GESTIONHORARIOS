/**
 * OCR con Google Gemini Flash — capa gratuita (15 req/min sin coste para bajo volumen).
 *
 * Transcribe el texto de IMÁGENES o PDFs (incluidos los escaneados) con Gemini.
 * Pipeline: imagen/PDF → Gemini (transcribe) → texto plano → Claude (análisis).
 *
 * Gemini acepta el PDF directamente (application/pdf), así que para PDFs
 * escaneados no hace falta rasterizar páginas ni `canvas`.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { registrarUsoIA, type UsoCtx } from "@/lib/ai/anthropic";

const GOOGLE_KEY = process.env.GOOGLE_AI_KEY || "";
const genAI = GOOGLE_KEY ? new GoogleGenerativeAI(GOOGLE_KEY) : null;

/**
 * Modelo de Gemini para el OCR. Configurable por entorno (GOOGLE_OCR_MODEL) por
 * si Google retira o renombra un modelo: así se cambia sin tocar el código.
 * Por defecto usa `gemini-3.5-flash` (verificado disponible en la cuenta).
 */
export const MODELO_OCR = () =>
  process.env.GOOGLE_OCR_MODEL?.trim() || "gemini-3.5-flash";

export type TipoImagen = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

const PROMPT_OCR =
  "Eres un OCR profesional. Transcribe TODO el texto visible. " +
  "Responde SOLO con el texto extraído, sin explicaciones. " +
  "Mantén la estructura de tablas/columnas usando ' | ' como separador. " +
  "Usa saltos de línea para filas diferentes. " +
  "Transcribe TODOS los nombres, números, horarios y abreviaturas EXACTAMENTE como aparecen. " +
  "Si hay varias secciones o tablas, sepáralas con una línea en blanco. " +
  "NO añadas comentarios, NO interpretes, NO traduzcas. Solo transcribe.";

/** Traduce los errores de la API de Gemini a mensajes claros para el usuario. */
function traducirError(error: unknown, queEs: string): Error {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("API_KEY_INVALID") || msg.includes("403"))
    return new Error("La API key de Google AI no es válida. Revisa GOOGLE_AI_KEY en .env");
  if (msg.includes("RATE_LIMIT") || msg.includes("429"))
    return new Error("Se ha superado el límite de Google AI. Espera un momento y vuelve a intentarlo.");
  if (msg.includes("SAFETY"))
    return new Error(`El ${queEs} ha sido bloqueado por los filtros de seguridad. Prueba con otro archivo.`);
  return new Error(`No se ha podido leer el texto del ${queEs}. Asegúrate de que sea nítido y legible.`);
}

/**
 * Núcleo compartido: envía los bytes (imagen o PDF) a Gemini y devuelve el texto.
 * Registra el consumo en `UsoIA` si se pasa `uso`.
 */
async function transcribirConGemini(
  mimeType: string,
  dataBase64: string,
  queEs: string,
  uso?: UsoCtx
): Promise<string> {
  if (!genAI) {
    throw new Error(
      "API key de Google AI no configurada (GOOGLE_AI_KEY). " +
      "Consigue una gratis en https://aistudio.google.com/apikey"
    );
  }

  const t0 = Date.now();
  const modeloOcr = MODELO_OCR();
  console.log(`[OCR-Gemini] Transcribiendo ${queEs} con ${modeloOcr}...`);

  try {
    const model = genAI.getGenerativeModel({ model: modeloOcr });
    const result = await model.generateContent([
      { inlineData: { mimeType, data: dataBase64 } },
      { text: PROMPT_OCR },
    ]);

    const response = result.response;
    const texto = response.text()?.trim() || "";
    const duracion = ((Date.now() - t0) / 1000).toFixed(1);
    const tokens = response.usageMetadata;
    console.log(
      `[OCR-Gemini] ✓ ${queEs} transcrito en ${duracion}s — ${texto.length} chars` +
      (tokens ? `, tokens: in=${tokens.promptTokenCount} out=${tokens.candidatesTokenCount}` : "")
    );

    // Registrar el consumo real para que aparezca en el panel de "Consumo de IA".
    if (uso) {
      await registrarUsoIA(
        uso,
        modeloOcr,
        tokens?.promptTokenCount ?? 0,
        tokens?.candidatesTokenCount ?? 0
      );
    }

    if (texto.length > 0) {
      console.log(`[OCR-Gemini] Preview: ${texto.slice(0, 400)}...`);
    } else {
      console.log(`[OCR-Gemini] ⚠️ No se ha detectado texto en el ${queEs}`);
    }
    return texto;
  } catch (error) {
    const duracion = ((Date.now() - t0) / 1000).toFixed(1);
    console.error(
      `[OCR-Gemini] Error después de ${duracion}s:`,
      error instanceof Error ? error.message : String(error)
    );
    throw traducirError(error, queEs);
  }
}

/**
 * Transcribe el texto visible de una IMAGEN (foto o captura) con Gemini.
 *
 * @param imagenBase64 - Imagen codificada en base64 (sin prefijo data:)
 * @param mediaType - Tipo MIME de la imagen
 * @param uso - Contexto para registrar el consumo (opcional)
 */
export async function extraerTextoDeImagen(
  imagenBase64: string,
  mediaType: TipoImagen,
  uso?: UsoCtx
): Promise<string> {
  return transcribirConGemini(mediaType, imagenBase64, "imagen", uso);
}

/**
 * Transcribe el texto de un PDF (incluidos los ESCANEADOS) con Gemini.
 * Gemini acepta el PDF directamente, sin rasterizar ni `canvas`. Úsalo como
 * respaldo cuando `pdf-parse` no extrae texto seleccionable.
 *
 * @param pdfBase64 - PDF codificado en base64 (sin prefijo data:)
 * @param uso - Contexto para registrar el consumo (opcional)
 */
export async function extraerTextoDePDF(
  pdfBase64: string,
  uso?: UsoCtx
): Promise<string> {
  return transcribirConGemini("application/pdf", pdfBase64, "PDF", uso);
}
