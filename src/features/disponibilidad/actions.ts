"use server";

import { revalidatePath } from "next/cache";
import { parseISO } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireSesion } from "@/lib/session";
import { fallo, type Resultado, requireResponsable } from "@/lib/guards";

const VALIDOS = ["DISPONIBLE", "PREFIERE_NO", "NO_DISPONIBLE"];

export type DispRecurrente = {
  diaSemana: number;
  estado: string;
  franjaInicio: string;
  franjaFin: string;
};
export type DispExcepcion = {
  fecha: string; // yyyy-MM-dd
  estado: string;
  franjaInicio: string;
  franjaFin: string;
};

/**
 * Guarda la disponibilidad del empleado: recurrente por día (con franja
 * horaria) + excepciones por fecha concreta.
 */
export async function guardarDisponibilidad(input: {
  recurrentes: DispRecurrente[];
  excepciones: DispExcepcion[];
}): Promise<Resultado> {
  const u = await requireSesion();
  if (!u.empleadoId) return fallo("Sin ficha de empleado");

  const recurrentes = (input.recurrentes ?? []).filter(
    (e) => e.diaSemana >= 0 && e.diaSemana <= 6 && VALIDOS.includes(e.estado)
  );
  const excepciones = (input.excepciones ?? []).filter(
    (e) => e.fecha && VALIDOS.includes(e.estado)
  );

  await prisma.$transaction([
    prisma.disponibilidad.deleteMany({ where: { empleadoId: u.empleadoId } }),
    // Solo guardamos lo que no es "disponible todo el día" (el valor por defecto).
    ...recurrentes
      .filter(
        (e) =>
          e.estado !== "DISPONIBLE" ||
          e.franjaInicio !== "00:00" ||
          e.franjaFin !== "23:59"
      )
      .map((e) =>
        prisma.disponibilidad.create({
          data: {
            empleadoId: u.empleadoId!,
            recurrente: true,
            diaSemana: e.diaSemana,
            estado: e.estado,
            franjaInicio: e.franjaInicio,
            franjaFin: e.franjaFin,
          },
        })
      ),
    ...excepciones.map((e) =>
      prisma.disponibilidad.create({
        data: {
          empleadoId: u.empleadoId!,
          recurrente: false,
          fecha: parseISO(e.fecha),
          estado: e.estado,
          franjaInicio: e.franjaInicio,
          franjaFin: e.franjaFin,
        },
      })
    ),
  ]);
  revalidatePath("/mi-disponibilidad");
  return { ok: true };
}

export async function guardarDisponibilidadEmpleado(
  empleadoId: string,
  input: {
    recurrentes: DispRecurrente[];
    excepciones: DispExcepcion[];
  }
): Promise<Resultado> {
  const u = await requireResponsable();
  const emp = await prisma.empleado.findUnique({
    where: { id: empleadoId },
    select: { organizacionId: true },
  });
  if (!emp || emp.organizacionId !== u.organizacionId) return fallo("Empleado no encontrado");

  const recurrentes = (input.recurrentes ?? []).filter(
    (e) => e.diaSemana >= 0 && e.diaSemana <= 6 && VALIDOS.includes(e.estado)
  );
  const excepciones = (input.excepciones ?? []).filter(
    (e) => e.fecha && VALIDOS.includes(e.estado)
  );

  await prisma.$transaction([
    prisma.disponibilidad.deleteMany({ where: { empleadoId } }),
    ...recurrentes
      .filter(
        (e) =>
          e.estado !== "DISPONIBLE" ||
          e.franjaInicio !== "00:00" ||
          e.franjaFin !== "23:59"
      )
      .map((e) =>
        prisma.disponibilidad.create({
          data: {
            empleadoId,
            recurrente: true,
            diaSemana: e.diaSemana,
            estado: e.estado,
            franjaInicio: e.franjaInicio,
            franjaFin: e.franjaFin,
          },
        })
      ),
    ...excepciones.map((e) =>
      prisma.disponibilidad.create({
        data: {
          empleadoId,
          recurrente: false,
          fecha: parseISO(e.fecha),
          estado: e.estado,
          franjaInicio: e.franjaInicio,
          franjaFin: e.franjaFin,
        },
      })
    ),
  ]);
  revalidatePath("/cuadrantes");
  revalidatePath("/empleados");
  return { ok: true };
}
