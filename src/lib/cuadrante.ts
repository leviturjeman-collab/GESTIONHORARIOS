import { prisma } from "@/lib/prisma";
import { duracionHoras, minutosDeHora, horasTurno } from "@/lib/utils";

/** Obtiene el cuadrante de una ubicación+semana, creándolo si no existe. */
export async function getOrCreateCuadrante(ubicacionId: string, semanaInicio: Date) {
  const existente = await prisma.cuadrante.findUnique({
    where: { ubicacionId_semanaInicio: { ubicacionId, semanaInicio } },
  });
  if (existente) return existente;
  return prisma.cuadrante.create({
    data: { ubicacionId, semanaInicio, estado: "BORRADOR" },
  });
}

type TurnoCobertura = {
  dia: Date;
  rol: string;
  horaInicio: string;
  horaFin: string;
  horaInicio2?: string | null;
  horaFin2?: string | null;
};

/** ¿El turno cubre (solapa) la franja [ini,fin) con el rol pedido? */
function turnoCubre(t: TurnoCobertura, rol: string, ini: string, fin: string): boolean {
  if (t.rol !== rol) return false;
  const a = minutosDeHora(ini);
  const b = minutosDeHora(fin);
  const tramos: Array<[number, number]> = [[minutosDeHora(t.horaInicio), minutosDeHora(t.horaFin)]];
  if (t.horaInicio2 && t.horaFin2)
    tramos.push([minutosDeHora(t.horaInicio2), minutosDeHora(t.horaFin2)]);
  return tramos.some(([ti, tf]) => ti < b && tf > a);
}

export type CoberturaDia = {
  diaIdx: number;
  ok: boolean;
  faltas: { rol: string; franja: string; faltan: number }[];
};

/** Evalúa la cobertura mínima por día frente a las reglas de la ubicación. */
export function evaluarCobertura(
  reglas: { rol: string; diaSemana: number | null; franjaInicio: string; franjaFin: string; minPersonas: number }[],
  turnos: (TurnoCobertura & { empleadoId: string })[],
  dias: Date[]
): CoberturaDia[] {
  return dias.map((dia, diaIdx) => {
    const delDia = turnos.filter((t) => sameDay(t.dia, dia));
    const faltas: CoberturaDia["faltas"] = [];
    for (const r of reglas) {
      if (r.diaSemana != null && r.diaSemana !== diaIdx) continue;
      const cubren = new Set(
        delDia.filter((t) => turnoCubre(t, r.rol, r.franjaInicio, r.franjaFin)).map((t) => t.empleadoId)
      );
      if (cubren.size < r.minPersonas) {
        faltas.push({
          rol: r.rol,
          franja: `${r.franjaInicio}–${r.franjaFin}`,
          faltan: r.minPersonas - cubren.size,
        });
      }
    }
    return { diaIdx, ok: faltas.length === 0, faltas };
  });
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export { horasTurno, duracionHoras };
