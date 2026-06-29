import { z } from "zod";
import { IA_ACTIVA, generarJSON, type UsoCtx } from "@/lib/ai/anthropic";
import { minutosDeHora } from "@/lib/utils";
import { esParcial } from "@/lib/enums";

export type TurnoPropuesto = {
  empleadoId: string;
  diaIdx: number; // 0=lunes … 6=domingo
  rol: string;
  horaInicio: string;
  horaFin: string;
  partido?: boolean;
  horaInicio2?: string;
  horaFin2?: string;
};

export type ContextoGeneracion = {
  empleados: {
    id: string;
    nombre: string;
    rol: string;
    tipo: string;
    horasContrato: number;
    diasDescanso: number;
    diasNoDisponibles: number[]; // 0..6
    restricciones?: string[];
  }[];
  reglas: { rol: string; franjaInicio: string; franjaFin: string; minPersonas: number }[];
  horaApertura: string;
  horaCierre: string;
};

const schema = z.object({
  turnos: z
    .array(
      z.object({
        empleadoId: z.string(),
        diaIdx: z.coerce.number().min(0).max(6),
        rol: z.string(),
        horaInicio: z.string(),
        horaFin: z.string(),
        partido: z.boolean().optional(),
        horaInicio2: z.string().optional(),
        horaFin2: z.string().optional(),
      })
    )
    .default([]),
  resumen: z.string().default(""),
});

function suma(h: string, horas: number): string {
  const m = minutosDeHora(h) + horas * 60;
  const hh = Math.floor((m % (24 * 60)) / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Generación heurística (modo simulado, sin coste de API): reparte las horas de contrato. */
export function generarHeuristico(
  ctx: ContextoGeneracion,
  params?: { maxHorasDia?: number; minHorasTurno?: number; diasFuertes?: number[] }
): { turnos: TurnoPropuesto[]; resumen: string } {
  const maxHoras = params?.maxHorasDia ?? 9;
  const minHoras = params?.minHorasTurno ?? 3;
  const diasFuertes = params?.diasFuertes ?? [];

  const turnos: TurnoPropuesto[] = [];
  for (const e of ctx.empleados) {
    const disponibles = [0, 1, 2, 3, 4, 5, 6].filter((d) => !e.diasNoDisponibles.includes(d));
    const numDescanso = e.diasDescanso ?? 2;
    const diasTrabajo = Math.max(1, disponibles.length - numDescanso);

    // Priorizar días fuertes; el resto en orden natural
    const sorted = [...disponibles].sort((a, b) => {
      const aF = diasFuertes.includes(a) ? 0 : 1;
      const bF = diasFuertes.includes(b) ? 0 : 1;
      return aF - bF || a - b;
    });
    const dias = sorted.slice(0, diasTrabajo);
    if (dias.length === 0) continue;

    const horasDia = Math.min(maxHoras, Math.max(minHoras, e.horasContrato / Math.max(1, dias.length)));
    for (const d of dias) {
      const reglaRol = ctx.reglas?.find((r) => r.rol === e.rol);
      const horaInicio = reglaRol
        ? reglaRol.franjaInicio
        : e.rol === "limpieza" || e.rol === "office"
        ? "06:00"
        : ctx.horaApertura;

      turnos.push({
        empleadoId: e.id,
        diaIdx: d,
        rol: e.rol,
        horaInicio,
        horaFin: suma(horaInicio, horasDia),
      });
    }
  }
  return {
    turnos,
    resumen: `Generación automática: ${turnos.length} turnos repartiendo las horas de contrato en los días disponibles.`,
  };
}

/** Genera una propuesta de cuadrante. Usa Claude si hay clave; si no, heurística. */
export async function generarTurnosIA(
  ctx: ContextoGeneracion,
  instruccion: string,
  uso?: UsoCtx
): Promise<{ turnos: TurnoPropuesto[]; resumen: string; modo: "ia" | "simulado" }> {
  if (!IA_ACTIVA) return { ...generarHeuristico(ctx), modo: "simulado" };
  try {
    const res = await generarJSON({
      schema,
      maxTokens: 4000,
      uso,
      system:
        "Eres un planificador de turnos experto. Genera un cuadrante semanal (lunes=0 … domingo=6).\n\n" +

        "═══════════════════════════════════════════════\n" +
        "BLOQUE 1 — REGLAS ABSOLUTAS (NUNCA romper)\n" +
        "═══════════════════════════════════════════════\n" +
        "1. diasNoDisponibles: PROHIBIDO asignar cualquier turno en días indicados como no disponibles.\n" +
        "2. Ausencias aprobadas: PROHIBIDO asignar turnos en fechas con ausencia.\n" +
        "3. permitePartido=false: ese empleado SOLO puede tener turnos continuos (partido=false siempre).\n" +
        "4. admiteHorasExtra=false: ese empleado NO puede superar sus horasContrato en ningún caso.\n" +
        "5. Horario del local: NINGÚN turno puede empezar antes de horaApertura ni terminar después de horaCierre, EXCEPTO limpieza/office que deben entrar 1-2 horas ANTES de apertura.\n" +
        "6. Restricciones individuales: respeta la lista 'restricciones' de cada empleado al pie de la letra.\n\n" +

        "═══════════════════════════════════════════════\n" +
        "BLOQUE 2 — REGLAS IMPORTANTES (romper solo si la cobertura mínima lo exige)\n" +
        "═══════════════════════════════════════════════\n" +
        "1. Horas de contrato: ajústate a horasContrato por semana (±15% máx si la cobertura lo requiere).\n" +
        "2. Días de descanso: cada empleado debe tener al menos diasDescanso días SIN turno.\n" +
        "3. Descanso entre jornadas: mínimo 12h entre el fin de un turno y el inicio del siguiente.\n" +
        "4. Días consecutivos: no más de 6 días seguidos sin descanso.\n" +
        "5. Cobertura mínima: cumple las reglas de minPersonas por rol y franja horaria.\n\n" +

        "═══════════════════════════════════════════════\n" +
        "BLOQUE 3 — PREFERENCIAS (aplicar si es posible, sin garantía)\n" +
        "═══════════════════════════════════════════════\n" +
        "1. preferenciaTurno del empleado (MAÑANA/TARDE): asignar en esa franja si los recursos lo permiten.\n" +
        "2. Equidad: repartir turnos de fin de semana y cierres de forma equilibrada entre la plantilla.\n" +
        "3. Descansos consecutivos: si es posible, los días libres deben ser seguidos.\n" +
        "4. Refuerzo en días fuertes: si hay días de mayor demanda indicados, priorizar cobertura allí.\n\n" +

        "Formato de salida: cada turno debe tener empleadoId, diaIdx, rol, horaInicio, horaFin ('HH:mm').\n" +
        "Si partido=true, incluye horaInicio2/horaFin2. Devuelve también un 'resumen' breve en español.",
      prompt:
        `Instrucción del responsable: "${instruccion || "Genera la semana de forma equilibrada."}"\n\n` +
        `Contexto:\n${JSON.stringify(ctx)}`,
    });
    return { turnos: res.turnos ?? [], resumen: res.resumen ?? "", modo: "ia" as const };
  } catch (e) {
    console.error("Fallo IA generación, usando heurística:", e instanceof Error ? e.message : String(e));
    return { ...generarHeuristico(ctx), modo: "simulado" };
  }
}
