import { horasTurno, minutosDeHora } from "@/lib/utils";
import { evaluarCobertura } from "@/lib/cuadrante";
import { etiquetaRol } from "@/lib/enums";

export type Problema = {
  tipo: "HUECO" | "EXCESO_HORAS" | "DESCANSO" | "SOLAPE" | "AUSENCIA";
  severidad: "alta" | "media";
  mensaje: string;
  empleadoId?: string;
};

type TurnoDet = {
  id: string;
  empleadoId: string;
  dia: Date;
  horaInicio: string;
  horaFin: string;
  horaInicio2?: string | null;
  horaFin2?: string | null;
  descansoMin?: number | null;
  rol: string;
};

/**
 * Detector de problemas (heurístico, determinista): huecos de cobertura,
 * exceso de horas, descansos insuficientes, solapes y conflictos con ausencias.
 */
export function detectarProblemas(input: {
  turnos: TurnoDet[];
  empleados: { id: string; nombre: string; apellidos?: string | null; horasContrato: number }[];
  reglas: { rol: string; diaSemana: number | null; franjaInicio: string; franjaFin: string; minPersonas: number }[];
  dias: Date[];
  ausencias: { empleadoId: string; fechaInicio: Date; fechaFin: Date }[];
}): Problema[] {
  const problemas: Problema[] = [];
  const nombre = (id: string) => {
    const e = input.empleados.find((x) => x.id === id);
    return e ? `${e.nombre} ${e.apellidos ?? ""}`.trim() : "Empleado";
  };

  // 1) Huecos de cobertura
  const cobertura = evaluarCobertura(input.reglas, input.turnos, input.dias);
  for (const c of cobertura) {
    for (const f of c.faltas) {
      problemas.push({
        tipo: "HUECO",
        severidad: "alta",
        mensaje: `Faltan ${f.faltan} de ${etiquetaRol(f.rol)} (${f.franja}) el ${diaNombre(c.diaIdx)}.`,
      });
    }
  }

  // Agrupa por empleado
  const porEmp = new Map<string, TurnoDet[]>();
  for (const t of input.turnos) {
    if (!porEmp.has(t.empleadoId)) porEmp.set(t.empleadoId, []);
    porEmp.get(t.empleadoId)!.push(t);
  }

  for (const [empId, turnos] of porEmp) {
    const emp = input.empleados.find((e) => e.id === empId);
    const horasContrato = emp?.horasContrato ?? 40;

    // 2) Exceso de horas
    const total = turnos.reduce((acc, t) => acc + horasTurno(t), 0);
    if (total > horasContrato + 5) {
      problemas.push({
        tipo: "EXCESO_HORAS",
        severidad: "media",
        empleadoId: empId,
        mensaje: `${nombre(empId)} tiene ${total.toFixed(1)} h asignadas (contrato ${horasContrato} h).`,
      });
    }

    // 3) Solapes el mismo día
    const porDia = new Map<string, TurnoDet[]>();
    for (const t of turnos) {
      const k = t.dia.toDateString();
      if (!porDia.has(k)) porDia.set(k, []);
      porDia.get(k)!.push(t);
    }
    for (const [, mismoDia] of porDia) {
      for (let i = 0; i < mismoDia.length; i++)
        for (let j = i + 1; j < mismoDia.length; j++) {
          if (solapan(mismoDia[i], mismoDia[j])) {
            problemas.push({
              tipo: "SOLAPE",
              severidad: "alta",
              empleadoId: empId,
              mensaje: `${nombre(empId)} tiene dos turnos solapados el mismo día.`,
            });
          }
        }
    }

    // 4) Descanso insuficiente entre días (< 12 h)
    const ordenados = [...turnos].sort((a, b) => a.dia.getTime() - b.dia.getTime());
    for (let i = 1; i < ordenados.length; i++) {
      const prev = ordenados[i - 1];
      const curr = ordenados[i];
      const finPrev = prev.dia.getTime() + minutosDeHora(prev.horaFin2 || prev.horaFin) * 60000;
      const iniCurr = curr.dia.getTime() + minutosDeHora(curr.horaInicio) * 60000;
      const gap = (iniCurr - finPrev) / 3600000;
      if (gap > 0 && gap < 12) {
        problemas.push({
          tipo: "DESCANSO",
          severidad: "media",
          empleadoId: empId,
          mensaje: `${nombre(empId)} descansa solo ${gap.toFixed(1)} h entre dos jornadas (mín. 12 h).`,
        });
      }
    }

    // 5) Conflicto con ausencias aprobadas
    for (const t of turnos) {
      const conflicto = input.ausencias.find(
        (a) => a.empleadoId === empId && t.dia >= startOfDay(a.fechaInicio) && t.dia <= a.fechaFin
      );
      if (conflicto) {
        problemas.push({
          tipo: "AUSENCIA",
          severidad: "alta",
          empleadoId: empId,
          mensaje: `${nombre(empId)} tiene un turno en un día de ausencia aprobada.`,
        });
      }
    }
  }

  return problemas;
}

function solapan(a: TurnoDet, b: TurnoDet): boolean {
  const ra: Array<[number, number]> = [[minutosDeHora(a.horaInicio), minutosDeHora(a.horaFin)]];
  const rb: Array<[number, number]> = [[minutosDeHora(b.horaInicio), minutosDeHora(b.horaFin)]];
  return ra.some(([ai, af]) => rb.some(([bi, bf]) => ai < bf && bi < af));
}
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function diaNombre(i: number) {
  return ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"][i];
}
