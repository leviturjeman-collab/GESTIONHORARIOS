import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { costeEur } from "@/lib/enums";

/**
 * Capa de acceso a la IA (Anthropic / Claude).
 *
 * Principios (spec §8.6):
 *  - La clave SOLO se usa en el servidor; nunca llega al cliente.
 *  - Minimización: se envían únicamente los datos necesarios.
 *  - Cada llamada registra tokens y coste en la entidad UsoIA.
 *  - Sin clave, la IA funciona en MODO SIMULADO (respuestas locales).
 *  - Modelo configurable por operación (Haiku análisis, Sonnet generación).
 */

const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
export const IA_ACTIVA = Boolean(apiKey);

const cliente = apiKey ? new Anthropic({ apiKey }) : null;

/** Contexto para registrar el consumo de IA. */
export type UsoCtx = {
  organizacionId: string;
  ubicacionId?: string | null;
  operacion: "ANALISIS" | "GENERACION" | "DETECCION" | "ASISTENTE" | "OCR";
};

const env = (k: string) => process.env[k]?.trim();

/** Modelo a usar según la operación (configurable por entorno). */
export function modeloPara(operacion: string): string | undefined {
  const base = env("ANTHROPIC_MODEL") || "claude-sonnet-4-6";
  if (operacion === "GENERACION")
    return env("ANTHROPIC_MODEL_GENERACION") || base || "claude-sonnet-4-6";
  if (operacion === "ASISTENTE") return env("ANTHROPIC_MODEL_ASISTENTE") || base;
  if (operacion === "DETECCION") return env("ANTHROPIC_MODEL_DETECCION") || base;
  if (operacion === "ANALISIS") return env("ANTHROPIC_MODEL_ANALISIS") || base || "claude-sonnet-4-6";
  return undefined;
}

async function registrarUso(
  uso: UsoCtx,
  modelo: string,
  entrada: number,
  salida: number
) {
  try {
    await prisma.usoIA.create({
      data: {
        organizacionId: uso.organizacionId,
        ubicacionId: uso.ubicacionId ?? null,
        operacion: uso.operacion,
        modelo,
        tokensEntrada: entrada,
        tokensSalida: salida,
        costeEur: costeEur(modelo, entrada, salida),
      },
    });
  } catch (e) {
    console.error("No se pudo registrar UsoIA:", e instanceof Error ? e.message : String(e));
  }
}

/**
 * Registra una llamada de IA externa (p. ej. OCR con Gemini), que no pasa por
 * `generarJSON`/`generarTexto`. Permite que el panel de "Consumo de IA" muestre
 * el modelo real y los tokens consumidos de cada API key.
 */
export async function registrarUsoIA(
  uso: UsoCtx,
  modelo: string,
  tokensEntrada: number,
  tokensSalida: number
): Promise<void> {
  await registrarUso(uso, modelo, tokensEntrada, tokensSalida);
}

/** Llama a Claude y devuelve texto plano. Null si no hay clave. */
export async function generarTexto(
  system: string,
  prompt: string,
  maxTokens = 1024,
  uso?: UsoCtx
): Promise<string | null> {
  if (!cliente) return null;
  const modelo = modeloPara(uso?.operacion ?? "ASISTENTE") || "claude-sonnet-4-6";
  const msg = await cliente.messages.create({
    model: modelo,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  if (uso) await registrarUso(uso, modelo, msg.usage.input_tokens, msg.usage.output_tokens);
  const bloque = msg.content.find((b) => b.type === "text");
  return bloque && bloque.type === "text" ? bloque.text : null;
}

const SUFIJO_JSON =
  "\n\nCRÍTICO: Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido. " +
  "NO escribas texto, explicaciones ni razonamiento antes del JSON. " +
  "NO uses ```. El primer carácter de tu respuesta debe ser {.";

/** Intenta reparar JSON truncado (por max_tokens) cerrando arrays/objetos abiertos. */
function repararJSON(texto: string): string {
  // Eliminar la última propiedad/elemento incompleto (trailing comma + partial value)
  let s = texto.replace(/,\s*"[^"]*"?\s*$/, "").replace(/,\s*$/, "");

  // Contar brackets/braces abiertos
  let braces = 0;
  let brackets = 0;
  let enString = false;
  let escape = false;
  for (const ch of s) {
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { enString = !enString; continue; }
    if (enString) continue;
    if (ch === "{") braces++;
    else if (ch === "}") braces--;
    else if (ch === "[") brackets++;
    else if (ch === "]") brackets--;
  }

  // Cerrar lo que falte
  while (brackets > 0) { s += "]"; brackets--; }
  while (braces > 0) { s += "}"; braces--; }
  return s;
}

/** Limpia y valida con Zod el texto JSON devuelto por el modelo. */
function parsearJSON<T>(texto: string, schema: z.ZodType<T, any, any>): T {
  let limpio = texto
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  // Si Claude emitió texto de razonamiento antes del JSON, cortarlo
  const primerBrace = limpio.indexOf("{");
  if (primerBrace > 0) {
    console.log(`[parsearJSON] Texto previo al JSON (${primerBrace} chars), cortando...`);
    limpio = limpio.slice(primerBrace);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(limpio);
  } catch {
    // Intentar reparar JSON truncado
    try {
      parsed = JSON.parse(repararJSON(limpio));
    } catch {
      const m = limpio.match(/[\[{][\s\S]*[\]}]/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch {
          try { parsed = JSON.parse(repararJSON(m[0])); } catch { parsed = {}; }
        }
      } else {
        parsed = {};
      }
    }
  }
  // Usar safeParse para no explotar con errores de validación
  const result = schema.safeParse(parsed);
  if (result.success) return result.data;
  // Log detallado del error pero seguir con lo que se pueda
  console.error("Zod validation errors:", JSON.stringify(result.error.issues.slice(0, 10)));
  // Reintentar con el schema pero usando parse (que aplica .catch()/.default())
  // Los .catch() en el schema harán que se use el valor por defecto
  return schema.parse(parsed);
}

/**
 * Llama a Claude pidiendo una salida JSON estructurada y la valida con Zod.
 * Registra el consumo si se pasa `uso`.
 */
export async function generarJSON<T>(opts: {
  system: string;
  prompt: string;
  schema: z.ZodType<T, any, any>;
  maxTokens?: number;
  uso?: UsoCtx;
  modelo?: string;
}): Promise<T> {
  if (!cliente) throw new Error("IA no configurada (ANTHROPIC_API_KEY vacío).");

  const modelo = opts.modelo || modeloPara(opts.uso?.operacion ?? "ANALISIS") || "claude-sonnet-4-6";
  const msg = await cliente.messages.create({
    model: modelo,
    max_tokens: opts.maxTokens ?? 2048,
    system: opts.system + SUFIJO_JSON,
    messages: [{ role: "user", content: opts.prompt }],
  });

  if (opts.uso)
    await registrarUso(opts.uso, modelo, msg.usage.input_tokens, msg.usage.output_tokens);

  const bloque = msg.content.find((b) => b.type === "text");
  const textoRaw = bloque && bloque.type === "text" ? bloque.text : "{}";
  console.log(`[generarJSON] modelo=${modelo} tokens_in=${msg.usage.input_tokens} tokens_out=${msg.usage.output_tokens} stop=${msg.stop_reason}`);
  console.log(`[generarJSON] respuesta (primeros 500 chars):`, textoRaw.slice(0, 500));
  return parsearJSON(textoRaw, opts.schema);
}

export type TipoImagen = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

/**
 * Igual que generarJSON pero analizando una IMAGEN (visión multimodal).
 * Útil para fotos o capturas de un cuadrante.
 */
export async function generarJSONImagen<T>(opts: {
  system: string;
  prompt: string;
  imagenBase64: string;
  mediaType: TipoImagen;
  schema: z.ZodType<T, any, any>;
  maxTokens?: number;
  uso?: UsoCtx;
  modelo?: string;
}): Promise<T> {
  if (!cliente) throw new Error("IA no configurada (ANTHROPIC_API_KEY vacío).");

  const modelo = opts.modelo || modeloPara(opts.uso?.operacion ?? "ANALISIS") || "claude-sonnet-4-6";
  const msg = await cliente.messages.create({
    model: modelo,
    max_tokens: opts.maxTokens ?? 3000,
    system: opts.system + SUFIJO_JSON,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: opts.mediaType, data: opts.imagenBase64 },
          },
          { type: "text", text: opts.prompt },
        ],
      },
    ],
  });

  if (opts.uso)
    await registrarUso(opts.uso, modelo, msg.usage.input_tokens, msg.usage.output_tokens);

  const bloque = msg.content.find((b) => b.type === "text");
  return parsearJSON(bloque && bloque.type === "text" ? bloque.text : "{}", opts.schema);
}
