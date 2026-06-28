import { horasTurno } from "@/lib/utils";

export type TurnoConEmpleado = {
  horaInicio: string;
  horaFin: string;
  horaInicio2?: string | null;
  horaFin2?: string | null;
  descansoMin?: number | null;
  empleado?: { contrato?: { costeHora: number; horasSemana: number } | null } | null;
};

/** Resumen de horas y coste de un conjunto de turnos. */
export function resumenTurnos(turnos: TurnoConEmpleado[]) {
  let horas = 0;
  let coste = 0;
  for (const t of turnos) {
    const h = horasTurno(t);
    horas += h;
    coste += h * (t.empleado?.contrato?.costeHora ?? 0);
  }
  return { horas, coste, numTurnos: turnos.length };
}

/**
 * Estima horas extra: suma de horas asignadas por empleado por encima de las
 * horas de su contrato en la semana.
 */
export function horasExtra(
  turnosPorEmpleado: Map<string, { turnos: TurnoConEmpleado[]; horasContrato: number }>
): number {
  let extra = 0;
  for (const { turnos, horasContrato } of turnosPorEmpleado.values()) {
    const asignadas = turnos.reduce((acc, t) => acc + horasTurno(t), 0);
    if (asignadas > horasContrato) extra += asignadas - horasContrato;
  }
  return extra;
}
