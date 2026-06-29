import { z } from "zod";
import {
  IA_ACTIVA,
  generarJSON,
  generarJSONImagen,
  generarJSONDocumento,
  type UsoCtx,
  type TipoImagen,
} from "@/lib/ai/anthropic";
import { ROLES_FUNCIONALES } from "@/lib/enums";
import { postProcesarResultado } from "@/lib/ai/normalize";
import { calcularCobertura, generarPreguntasInteligentes, type AnalisisCobertura, type ResumenRol } from "@/lib/ai/cobertura";
import { SYSTEM_ANALISIS_V5 as SYSTEM_ANALISIS, EXCEL_CONTEXT } from "@/lib/ai/prompts";

export type Confianza = "alta" | "media";

export type EmpleadoDetectado = {
  nombre: string;
  tipo: "COMPLETO" | "PARCIAL";
  horasSemana: number;
  horasExtra: number;
  diasDescanso: number;
  rol: string;
  seccion?: string;
  observaciones?: string;
  estado?: "ACTIVO" | "BAJA" | "VACACIONES";
  confianza: Record<string, Confianza>;
  turnos?: {
    diaIdx: number;
    horaInicio: string;
    horaFin: string;
    partido?: boolean;
    horaInicio2?: string;
    horaFin2?: string;
  }[];
};

export type PreguntaIA = {
  pregunta: string;
  opciones: string[];
  tipoUI?: "selector_empleados" | "selector_roles" | "curva_demanda" | "texto" | "selector_horario" | "selector_dias" | "anomalia";
};

export type ResultadoAnalisis = {
  empleados: EmpleadoDetectado[];
  preguntas: PreguntaIA[];
  modo: "ia" | "simulado";
  cobertura?: AnalisisCobertura;
};

const schemaIA = z.object({
  empleados: z
    .array(
      z.object({
        nombre: z.string(),
        tipo: z.enum(["COMPLETO", "PARCIAL"]).catch("COMPLETO"),
        horasSemana: z.coerce.number().catch(40),
        horasExtra: z.coerce.number().catch(0),
        diasDescanso: z.coerce.number().catch(2),
        rol: z.string().catch(""),
        seccion: z.string().nullable().optional().transform(v => v ?? undefined),
        ubicacion: z.string().nullable().optional().transform(v => v ?? undefined),
        observaciones: z.string().nullable().optional().transform(v => v ?? undefined),
        estado: z.enum(["ACTIVO", "BAJA", "VACACIONES"]).catch("ACTIVO"),
        turnos: z
          .array(
            z.object({
              diaIdx: z.coerce.number().min(0).max(6).catch(0),
              horaInicio: z.string().catch("00:00"),
              horaFin: z.string().catch("00:00"),
              partido: z.boolean().optional().catch(false),
              horaInicio2: z.string().nullable().optional().transform(v => v ?? undefined),
              horaFin2: z.string().nullable().optional().transform(v => v ?? undefined),
              esCierre: z.boolean().optional().catch(false),
            }).catch({ diaIdx: 0, horaInicio: "00:00", horaFin: "00:00" })
          )
          .optional()
          .catch([])
          .default([]),
        // Claude puede devolver valores inesperados como "baja" — normalizar a "media".
        confianza: z
          .record(z.string())
          .default({})
          .transform((rec) => {
            const out: Record<string, "alta" | "media"> = {};
            for (const [k, v] of Object.entries(rec)) {
              out[k] = v === "alta" ? "alta" : "media";
            }
            return out;
          }),
      })
    )
    .default([]),
  preguntas: z
    .array(
      z.union([
        z.object({
          pregunta: z.string(),
          opciones: z.array(z.string()).default([]),
          tipoUI: z.enum(["selector_empleados", "selector_roles", "curva_demanda", "texto", "selector_horario", "selector_dias", "anomalia"]).optional(),
        }),
        // Compatibilidad: si Claude devuelve strings planos, los transformamos
        z.string().transform((s) => ({ pregunta: s, opciones: [], tipoUI: "texto" as const })),
      ])
    )
    .default([]),
});

const SINONIMOS: Record<string, string[]> = {
  nombre: ["nombre", "empleado", "trabajador", "name", "persona"],
  tipo: ["tipo", "contrato", "jornada"],
  horas: ["horas", "horas/semana", "horas semana", "h/semana", "horassemana"],
  extra: ["extra", "horas extra", "extras"],
  descanso: ["descanso", "libra", "días libres", "dias descanso", "dia libre"],
  rol: ["rol", "puesto", "categoría", "categoria", "función", "funcion"],
};

/**
 * Análisis nativo de PDF (Claude 3.5 Sonnet - multimodal).
 */
export async function analizarPDFDocumento(
  pdfBase64: string,
  uso?: UsoCtx
): Promise<ResultadoAnalisis> {
  const PROMPT_PDF = `
Eres un analista de RRHH. Te he adjuntado un documento PDF que representa un cuadrante horario o un horario de trabajo semanal/mensual.

${SYSTEM_ANALISIS}

CRÍTICO:
El documento adjunto es el cuadrante. Extrae TODOS los empleados, sus roles, horas de contrato (si aparecen), descansos, bajas y sus turnos (días y horas). 
ATENCIÓN: Si el cuadrante es de varias semanas, EXTRAE ÚNICAMENTE UNA SEMANA REPRESENTATIVA (7 días) DE TURNOS PARA CADA EMPLEADO. Si un empleado está de vacaciones o baja la primera semana, busca sus turnos en la siguiente semana en la que trabaje para obtener su horario habitual. El objetivo es NO saturar la respuesta, extrayendo solo 1 semana normal por persona. Cruza cada nombre con la columna del día correspondiente.
`;

  return await generarJSONDocumento<ResultadoAnalisis>({
    system: "Eres un experto en lectura de cuadrantes de hostelería.",
    prompt: PROMPT_PDF,
    documentBase64: pdfBase64,
    mediaType: "application/pdf",
    schema: schemaIA,
    uso,
    maxTokens: 8192,
  });
}

function normaliza(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function detectarRol(valor: string): { rol: string; conf: Confianza } {
  const v = normaliza(valor);
  for (const r of ROLES_FUNCIONALES) {
    if (v.includes(r.replace("_", " ")) || v.includes(r)) return { rol: r, conf: "alta" };
  }
  if (v.includes("cociner") || v.includes("chef")) return { rol: "cocinero", conf: "alta" };
  if (v.includes("camarer") || v.includes("mesero")) return { rol: "camarero", conf: "alta" };
  if (v.includes("encargad") || v.includes("jefe") || v.includes("manager")) return { rol: "encargado", conf: "alta" };
  if (v.includes("barra") || v.includes("bartender") || v.includes("barman")) return { rol: "barra", conf: "alta" };
  if (v.includes("cajer") || v.includes("caja")) return { rol: "cajero", conf: "alta" };
  if (v.includes("repartid") || v.includes("delivery") || v.includes("rider")) return { rol: "repartidor", conf: "alta" };
  if (v.includes("limpieza") || v.includes("fregador")) return { rol: "limpieza", conf: "alta" };
  return { rol: "camarero", conf: "media" };
}

// ───────── Heurístico A: tablas resumen con HORAS CONTRATO (cuadrantes reales) ─────────

/** Mapea una etiqueta de sección/tabla a un rol funcional. */
function rolDeSeccion(texto: string): string | null {
  const n = normaliza(texto);
  if (!n) return null;
  if (n.includes("ayud") && n.includes("cocina")) return "ayudante_cocina";
  if (n.includes("sala") || n.includes("camarer")) return "camarero";
  if (n.includes("cocina") || n.includes("kitchen")) return "cocinero";
  if (n.includes("repartid") || n.includes("delivery") || n.includes("rider")) return "repartidor";
  if (n.includes("limpieza") || n.includes("fregad")) return "limpieza";
  if (n.includes("barra")) return "barra";
  if (n.includes("prepar") || n.includes("envio") || n.includes("envío")) return "office";
  return null;
}

const PALABRAS_NO_NOMBRE = new Set([
  "total", "totales", "final", "trabajadores", "trabajador", "fecha", "fechas",
  "horas", "contrato", "observaciones", "baja", "bajas", "vacaciones", "vacas",
  "nocturnidad", "festivos", "preparacion", "preparación", "cocina", "sala",
  "envios", "envíos", "peticiones", "enviada", "importante",
]);

/** Devuelve el índice de la columna de "horas de contrato" en una cabecera, o -1. */
function colHorasContrato(fila: string[]): number {
  for (let i = 0; i < fila.length; i++) {
    const n = normaliza(fila[i]);
    if (
      n.includes("horas contrato") ||
      n.includes("horas contrad") ||
      n.includes("horas contrat") ||
      n.includes("contratad")
    )
      return i;
  }
  return -1;
}

/** Clave normalizada para deduplicar (sin acentos, sin iniciales sueltas). */
function claveNombre(nombre: string): string {
  const n = normaliza(nombre).replace(/[*().,]/g, " ").replace(/\s+/g, " ").trim();
  const toks = n.split(" ").filter((t) => t.length > 1);
  return toks.length ? toks.join(" ") : n;
}

function tituloCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|\s|\/)([a-záéíóúñ])/g, (_, sep: string, c: string) => sep + c.toUpperCase())
    .trim();
}

/** Extrae la plantilla de las tablas resumen (TRABAJADORES | HORAS CONTRATO | …). */
function extraerDeResumen(filas: any[][]): EmpleadoDetectado[] {
  const porClave = new Map<string, EmpleadoDetectado>();
  let seccion: string | null = null;
  let colHoras = -1;
  let dentroTabla = false;

  for (const filaRaw of filas) {
    const fila = (filaRaw || []).map((c: any) => String(c ?? ""));
    const noVacias = fila.filter((c) => c.trim() !== "");

    // ¿Cabecera de tabla con horas de contrato?
    const idx = colHorasContrato(fila);
    if (idx >= 0) {
      colHoras = idx;
      dentroTabla = true;
      continue;
    }

    // ¿Etiqueta de sección (rol)? Una sola celda con texto reconocible.
    if (noVacias.length === 1) {
      const r = rolDeSeccion(noVacias[0]);
      if (r) seccion = r;
      continue;
    }

    if (!dentroTabla || colHoras < 0) continue;

    const nombre0 = (fila[0] || "").trim();
    if (!nombre0) continue;
    const nrm = normaliza(nombre0);
    if (PALABRAS_NO_NOMBRE.has(nrm) || nrm.startsWith("semana") || nrm.includes("trabajador"))
      continue;

    const horas = Number(String(fila[colHoras] ?? "").replace(",", "."));
    if (!Number.isFinite(horas) || horas <= 0 || horas > 80) continue; // sin horas válidas → no es plantilla

    // "FERNANDO/ANDRES" = dos personas que rotan.
    for (const nom of nombre0.split("/").map((s) => s.trim()).filter(Boolean)) {
      const clave = claveNombre(nom);
      if (!clave || porClave.has(clave)) continue; // primera aparición (con sección) gana
      const rol = seccion ?? detectarRol(nom).rol;
      porClave.set(clave, {
        nombre: tituloCase(nom),
        tipo: horas >= 35 ? "COMPLETO" : "PARCIAL",
        horasSemana: horas,
        horasExtra: 0,
        diasDescanso: 2,
        rol,
        confianza: {
          nombre: "alta",
          horasSemana: "alta",
          tipo: "alta",
          rol: seccion ? "alta" : "media",
        },
      });
    }
  }

  return [...porClave.values()];
}

const PREGUNTAS_BASE: PreguntaIA[] = [
  { pregunta: "¿Cuántas personas necesitas de cada rol en cada franja horaria?", opciones: ["1-2 por turno", "3-4 por turno", "5 o más por turno", "Depende del día"] },
  { pregunta: "¿Qué empleados pueden hacer turnos partidos?", opciones: ["Todos", "Solo los de jornada completa", "Ninguno", "Algunos (lo configuro luego)"] },
  { pregunta: "¿Cuál es el horario de apertura?", opciones: ["8:00 - 16:00", "9:00 - 23:00", "12:00 - 00:00", "8:00 - 00:00"] },
  { pregunta: "¿Qué días tienen más trabajo?", opciones: ["Viernes y sábado", "Fines de semana", "Todos por igual", "Entre semana"] },
];

/** Heurístico (sin IA): primero tablas-resumen; si no, tabla plana clásica. */
function analizarHeuristico(filas: any[][]): ResultadoAnalisis {
  const deResumen = extraerDeResumen(filas);
  if (deResumen.length >= 3) {
    return { empleados: deResumen, preguntas: PREGUNTAS_BASE, modo: "simulado" };
  }
  return analizarFlat(filas);
}

// ───────── Heurístico B: tabla plana (Nombre / Tipo / Horas / Rol / Descanso) ─────────

/** Interpreta una hoja con una fila por empleado y cabeceras reconocibles. */
function analizarFlat(filas: any[][]): ResultadoAnalisis {
  // Localiza la fila de cabeceras.
  let cab = -1;
  let mapa: Record<string, number> = {};
  for (let i = 0; i < Math.min(filas.length, 8); i++) {
    const fila = filas[i] ?? [];
    const m: Record<string, number> = {};
    fila.forEach((celda, idx) => {
      const n = normaliza(celda);
      for (const [clave, syns] of Object.entries(SINONIMOS)) {
        if (syns.some((s) => n === s || n.includes(s))) m[clave] = idx;
      }
    });
    if (Object.keys(m).length >= 2) {
      cab = i;
      mapa = m;
      break;
    }
  }

  const empleados: EmpleadoDetectado[] = [];
  const inicio = cab >= 0 ? cab + 1 : 0;
  const colNombre = mapa.nombre ?? 0;

  for (let i = inicio; i < filas.length; i++) {
    const fila = filas[i] ?? [];
    const nombre = String(fila[colNombre] ?? "").trim();
    if (!nombre || normaliza(nombre) === "total") continue;

    const conf: Record<string, Confianza> = { nombre: "alta" };

    const horasRaw = mapa.horas != null ? Number(fila[mapa.horas]) : NaN;
    const horasSemana = Number.isFinite(horasRaw) ? horasRaw : 40;
    conf.horasSemana = Number.isFinite(horasRaw) ? "alta" : "media";

    let tipo: "COMPLETO" | "PARCIAL";
    if (mapa.tipo != null) {
      const t = normaliza(fila[mapa.tipo]);
      tipo = t.includes("parcial") || t.includes("part") ? "PARCIAL" : "COMPLETO";
      conf.tipo = "alta";
    } else {
      tipo = horasSemana >= 35 ? "COMPLETO" : "PARCIAL";
      conf.tipo = "media";
    }

    const extraRaw = mapa.extra != null ? Number(fila[mapa.extra]) : NaN;
    const horasExtra = Number.isFinite(extraRaw) ? extraRaw : 0;
    conf.horasExtra = Number.isFinite(extraRaw) ? "alta" : "media";

    const descRaw = mapa.descanso != null ? Number(fila[mapa.descanso]) : NaN;
    const diasDescanso = Number.isFinite(descRaw) ? descRaw : 2;
    conf.diasDescanso = Number.isFinite(descRaw) ? "alta" : "media";

    const { rol, conf: confRol } = detectarRol(mapa.rol != null ? fila[mapa.rol] : "");
    conf.rol = confRol;

    empleados.push({ nombre, tipo, horasSemana, horasExtra, diasDescanso, rol, confianza: conf });
  }

  const preguntas: PreguntaIA[] = [];
  if (mapa.rol == null)
    preguntas.push({ pregunta: "¿Qué rol tiene cada empleado?", opciones: ["Camarero", "Cocinero", "Barra", "Encargado", "Otro"] });
  if (mapa.descanso == null)
    preguntas.push({ pregunta: "¿Cuántos días libra a la semana cada empleado?", opciones: ["1 día", "2 días", "Varía según empleado"] });
  preguntas.push({ pregunta: "¿Cuántas personas necesitas de cada rol en cada franja horaria?", opciones: ["1-2 por turno", "3-4 por turno", "5 o más por turno", "Depende del día"] });
  preguntas.push({ pregunta: "¿Qué empleados pueden hacer turnos partidos?", opciones: ["Todos", "Solo los de jornada completa", "Ninguno", "Algunos (lo configuro luego)"] });
  preguntas.push({ pregunta: "¿Cuál es el horario de apertura?", opciones: ["8:00 - 16:00", "9:00 - 23:00", "12:00 - 00:00", "8:00 - 00:00"] });
  preguntas.push({ pregunta: "¿Qué días tienen más trabajo?", opciones: ["Viernes y sábado", "Fines de semana", "Todos por igual", "Entre semana"] });

  return { empleados, preguntas, modo: "simulado" };
}

/** Asegura que el resultado sea serializable para Next.js server actions. */
function limpiarResultado(res: ResultadoAnalisis): ResultadoAnalisis {
  return {
    modo: res.modo,
    preguntas: res.preguntas.map((p) => ({ pregunta: p.pregunta, opciones: [...p.opciones] })),
    empleados: res.empleados.map((e) => ({
      nombre: e.nombre,
      tipo: e.tipo,
      horasSemana: e.horasSemana,
      horasExtra: e.horasExtra,
      diasDescanso: e.diasDescanso,
      rol: normalizarRol(e.rol),
      seccion: e.seccion,
      observaciones: e.observaciones,
      estado: e.estado,
      confianza: { ...e.confianza },
      turnos: e.turnos?.map((t) => ({
        diaIdx: t.diaIdx,
        horaInicio: t.horaInicio,
        horaFin: t.horaFin,
        partido: t.partido,
        horaInicio2: t.horaInicio2,
        horaFin2: t.horaFin2,
      })) ?? [],
    })),
  };
}

/** Mapea un rol libre devuelto por Claude al ROLES_FUNCIONALES más cercano. */
function normalizarRol(rol: string): string {
  if (!rol) return "camarero";
  const r = rol.toLowerCase().trim();
  // Coincidencia directa
  if ((ROLES_FUNCIONALES as readonly string[]).includes(r)) return r;
  // Mapeo por sinónimos comunes
  const MAPA: Record<string, string> = {
    // Cocinero
    cociner: "cocinero", cocinera: "cocinero", chef: "cocinero", jefe_cocina: "cocinero", cocina: "cocinero",
    // Camarero
    camarer: "camarero", camarera: "camarero", mesero: "camarero", mesera: "camarero", servicio: "camarero", sala: "camarero",
    // Barra
    barman: "barra", bartender: "barra", barista: "barra",
    // Encargado
    encargad: "encargado", encargada: "encargado", jefe: "encargado", jefa: "encargado", responsable: "encargado", gerente: "encargado", manager: "encargado", supervisor: "encargado", supervisora: "encargado",
    // Cajero
    cajer: "cajero", cajera: "cajero", caja: "cajero",
    // Repartidor
    repartidor: "repartidor", repartidora: "repartidor", delivery: "repartidor", rider: "repartidor", runner: "repartidor",
    // Limpieza
    limpieza: "limpieza", fregador: "limpieza", friegaplatos: "limpieza",
    // Ayudante cocina
    ayudante: "ayudante_cocina", pinche: "ayudante_cocina", auxiliar_cocina: "ayudante_cocina",
    // Office
    office: "office", auxiliar: "office",
    // Host
    recepcion: "host", hostess: "host", maître: "host", maitre: "host",
    // Otros mapeos
    sommelier: "barra", sumiller: "barra",
  };
  // Si no coincide nada, devolver el rol tal cual (puede ser un rol de otra industria)
  return r || "sin_rol";
}

/**
 * Modelo para el análisis del cuadrante. Configurable de forma INDEPENDIENTE de
 * la generación: pon ANTHROPIC_MODEL_ANALISIS="claude-opus-4-8" para máxima
 * precisión en archivos difíciles, sin encarecer el resto de operaciones.
 */
const MODELO_ONBOARDING = () =>
  process.env.ANTHROPIC_MODEL_ANALISIS?.trim() ||
  process.env.ANTHROPIC_MODEL?.trim() ||
  "claude-sonnet-4-6";


function procesarYEnriquecer(res: ResultadoAnalisis): ResultadoAnalisis {
  // 1. Normalizar (dedup, horas, contratos)
  const normalizado = postProcesarResultado(res);

  // 2. Calcular cobertura si hay turnos
  const tieneTurnos = normalizado.empleados.some(
    (e) => e.turnos && e.turnos.length > 0
  );

  if (tieneTurnos) {
    const cobertura = calcularCobertura(normalizado.empleados);

    // 3. Fusionar preguntas: las de cobertura (basadas en datos) + las de Claude
    const preguntasClaude = normalizado.preguntas;
    const preguntasCobertura = cobertura.preguntas;

    // Las de cobertura son más específicas → priorizarlas.
    // Filtrar las de Claude que se solapen en tema.
    const temasCobertura = new Set(
      preguntasCobertura.map((p) => {
        if (p.pregunta.includes("apertura") || p.pregunta.includes("cierre")) return "horario";
        if (p.pregunta.includes("punta") || p.pregunta.includes("días")) return "dias_pico";
        if (p.pregunta.includes("partido")) return "turnos_partidos";
        if (p.pregunta.includes("cierre semanal") || p.pregunta.includes("cierre?")) return "dia_cierre";
        return p.pregunta;
      })
    );

    const preguntasClaudeFiltradas = preguntasClaude.filter((p) => {
      const tema = p.pregunta.toLowerCase();
      if (temasCobertura.has("horario") && (tema.includes("apertura") || tema.includes("horario"))) return false;
      if (temasCobertura.has("dias_pico") && (tema.includes("trabajo") || tema.includes("afluencia"))) return false;
      if (temasCobertura.has("turnos_partidos") && tema.includes("partido")) return false;
      if (temasCobertura.has("dia_cierre") && tema.includes("cierre")) return false;
      return true;
    });

    return {
      ...normalizado,
      cobertura,
      preguntas: [...preguntasCobertura, ...preguntasClaudeFiltradas],
    };
  }

  // Sin turnos importados: generar igualmente el conjunto completo de preguntas
  // usando stubs mínimos de rol para que generarPreguntasInteligentes funcione.
  const rolesUnicos = [...new Set(normalizado.empleados.map((e) => e.rol || "sin_rol"))];
  const rolesMinimos: ResumenRol[] = rolesUnicos.map((rol) => {
    const empsRol = normalizado.empleados.filter((e) => e.rol === rol);
    return {
      rol,
      totalEmpleados: empsRol.length,
      horasContratoPromedio: Math.round(empsRol.reduce((s, e) => s + e.horasSemana, 0) / Math.max(1, empsRol.length)),
      cobertura: { matriz: Array.from({ length: 7 }, () => Array(24).fill(0)) },
      franjaMaxima: { inicio: "12:00", fin: "16:00", personas: 1 },
      franjaMinima: null,
      picosPorDia: Array(7).fill(0),
    };
  });

  const preguntasInteligentes = generarPreguntasInteligentes(rolesMinimos, {
    horaApertura: "09:00",
    horaCierre: "23:00",
    diasPico: [],
  });

  // Deduplicar: las inteligentes tienen prioridad; filtrar las de Claude que solapen.
  const temasInteligentes = new Set(
    preguntasInteligentes.map((p) => {
      const pl = p.pregunta.toLowerCase();
      if (pl.includes("apertura") || pl.includes("horario")) return "horario";
      if (pl.includes("cierra") || pl.includes("día completo")) return "cierre";
      if (pl.includes("partido")) return "partido";
      if (pl.includes("descanso entre")) return "descanso_entre";
      if (pl.includes("días libres") || pl.includes("días seguidos")) return "descanso";
      return pl.slice(0, 30);
    })
  );

  const preguntasClaudeFiltradas = normalizado.preguntas.filter((p) => {
    const pl = p.pregunta.toLowerCase();
    if (temasInteligentes.has("horario") && (pl.includes("apertura") || pl.includes("horario"))) return false;
    if (temasInteligentes.has("partido") && pl.includes("partido")) return false;
    if (temasInteligentes.has("cierre") && pl.includes("cierra")) return false;
    return true;
  });

  return {
    ...normalizado,
    preguntas: [...preguntasInteligentes, ...preguntasClaudeFiltradas],
  };
}

/** Analiza las filas del Excel. Usa Claude si hay clave; si no, heurística. */
export async function analizarExcel(
  filas: any[][],
  uso?: UsoCtx
): Promise<ResultadoAnalisis> {
  if (!IA_ACTIVA) {
    console.log("[onboarding] IA no activa, usando heurística");
    return limpiarResultado(procesarYEnriquecer(analizarHeuristico(filas)));
  }

  try {
    const modelo = MODELO_ONBOARDING();
    console.log(`[onboarding] Usando modelo: ${modelo}, filas: ${filas.length}`);
    const muestra = filas.slice(0, 300);
    const res = await generarJSON({
      schema: schemaIA,
      maxTokens: 8192,
      uso,
      modelo,
      system:
        SYSTEM_ANALISIS + EXCEL_CONTEXT,
      prompt:
        "Analiza estas filas (puede haber varias hojas) y devuelve la plantilla de personal deduplicada:\n" +
        JSON.stringify(muestra),
    });
    console.log(`[onboarding] Claude devolvió ${res.empleados.length} empleados`);
    console.log(`[onboarding] Roles detectados:`, [...new Set(res.empleados.map(e => e.rol))]);
    console.log(`[onboarding] Preguntas:`, res.preguntas.length);
    const resultado = limpiarResultado(procesarYEnriquecer({ ...res, modo: "ia" }));
    console.log(`[onboarding] Post-proceso: ${resultado.empleados.length} empleados, roles:`, [...new Set(resultado.empleados.map(e => e.rol))]);
    return resultado;
  } catch (e) {
    console.error("[onboarding] Fallo IA, usando heurística:", e instanceof Error ? e.message : String(e));
    return limpiarResultado(procesarYEnriquecer(analizarHeuristico(filas)));
  }
}

/**
 * Analiza una IMAGEN de un cuadrante/listado (foto o captura) con visión.
 * Requiere clave de IA: no hay heurística posible para imágenes.
 */
export async function analizarImagen(
  imagenBase64: string,
  mediaType: TipoImagen,
  uso?: UsoCtx
): Promise<ResultadoAnalisis> {
  const res = await generarJSONImagen({
    schema: schemaIA,
    imagenBase64,
    mediaType,
    maxTokens: 6000,
    uso,
    modelo: MODELO_ONBOARDING(),
    system:
      SYSTEM_ANALISIS +
      "\n\nEstás analizando una IMAGEN (foto, captura o documento escaneado).\n" +
      "Lee con cuidado fila por fila. Interpreta abreviaturas (M=mañana, T=tarde, L/X=libre).\n" +
      "Si hay horarios por día, suma las horas de la semana para cada empleado.",
    prompt:
      "Analiza esta imagen del cuadrante/listado. Extrae TODOS los empleados con nombre, rol y horas.",
  });
  return limpiarResultado(procesarYEnriquecer({ ...res, modo: "ia" }));
}

/**
 * Analiza texto plano extraído de un PDF.
 * maxTokens=6000 → coste ≤ €0.15 por análisis.
 */
export async function analizarTextoPlano(
  texto: string,
  uso?: UsoCtx
): Promise<ResultadoAnalisis> {
  if (!IA_ACTIVA) {
    return { empleados: [], preguntas: PREGUNTAS_BASE, modo: "simulado" };
  }
  try {
    const res = await generarJSON({
      schema: schemaIA,
      maxTokens: 8192,
      uso,
      modelo: MODELO_ONBOARDING(),
      system:
        SYSTEM_ANALISIS +
        "\n\nEstás analizando TEXTO PLANO extraído de un PDF. " +
        "El formato puede ser irregular. Espacios múltiples = separación de columnas.",
      prompt:
        "Analiza este documento y extrae todos los empleados:\n\n" +
        texto.slice(0, 15000),
    });
    return limpiarResultado(procesarYEnriquecer({ ...res, modo: "ia" }));
  } catch (e) {
    console.error("Fallo IA texto plano:", e instanceof Error ? e.message : String(e));
    return { empleados: [], preguntas: PREGUNTAS_BASE, modo: "simulado" };
  }
}
