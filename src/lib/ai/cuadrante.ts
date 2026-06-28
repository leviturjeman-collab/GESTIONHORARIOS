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
export function generarHeuristico(ctx: ContextoGeneracion): { turnos: TurnoPropuesto[]; resumen: string } {
  const turnos: TurnoPropuesto[] = [];
  for (const e of ctx.empleados) {
    const disponibles = [0, 1, 2, 3, 4, 5, 6].filter((d) => !e.diasNoDisponibles.includes(d));
    const diasTrabajo = Math.min(disponibles.length, esParcial(e.tipo) ? 4 : 5);
    const dias = disponibles.slice(0, diasTrabajo);
    if (dias.length === 0) continue;
    const horasDia = Math.max(3, Math.min(9, e.horasContrato / Math.max(1, dias.length)));
    for (const d of dias) {
      const reglaRol = ctx.reglas?.find((r) => r.rol === e.rol);
      const horaInicio = reglaRol
        ? reglaRol.franjaInicio
        : e.rol === "limpieza" || e.rol === "office"
        ? "04:00"
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
    resumen: `Generación automática: ${turnos.length} turnos repartiendo las horas de contrato en los días disponibles (respetando horarios de limpieza/office y reglas de cobertura).`,
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
        "Eres un planificador de turnos de hostelería. Genera un cuadrante semanal (lunes=0 … domingo=6).\n" +
        "Reglas fundamentales a respetar obligatoriamente:\n" +
        "1. Horas de contrato: Intenta ajustarte a las horas semanales de contrato de cada empleado. Si las necesidades de cobertura mínima del local lo requieren, se les puede asignar algunas horas extras (superando las horas de su contrato).\n" +
        "2. Días de descanso: Cada empleado debe tener al menos el número de días de descanso especificados en 'diasDescanso' (generalmente 2 días de descanso a la semana, marcados sin turnos).\n" +
        "3. Días no disponibles: No asignes turnos en los días indicados en 'diasNoDisponibles'.\n" +
        "4. Restricciones horarias: Respeta estrictamente la lista de 'restricciones' de cada empleado (por ejemplo, si no puede trabajar en ciertas franjas horarias o días, o notas específicas).\n" +
        "5. REGLA ESTRICTA DE PREPARACIÓN Y LIMPIEZA: Los empleados con rol 'limpieza', 'office' (o ayudantes de preparación) DEBEN entrar a trabajar ANTES de la hora de apertura del local (por ejemplo, 1 o 2 horas antes, o a las 06:00 am si es necesario preparar). Por el contrario, los cocineros, camareros y personal de servicio NUNCA deben empezar su turno antes de la hora de apertura (empiezan justo a la hora de apertura o más tarde).\n" +
        "6. Cobertura mínima: Asegura la cobertura mínima por rol y franja horaria definida en las reglas.\n" +
        "Cada turno debe contener: empleadoId, diaIdx, rol, horaInicio, horaFin ('HH:mm'). Marca partido=true con horaInicio2/horaFin2 si procede.\n" +
        "Devuelve también un 'resumen' breve en español de lo que has hecho.",
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
