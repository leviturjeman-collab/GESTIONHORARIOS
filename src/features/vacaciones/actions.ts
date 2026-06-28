"use server";

import { revalidatePath } from "next/cache";
import { parseISO } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireSesion } from "@/lib/session";
import { requireResponsable, empleadoEnAmbito, fallo, type Resultado } from "@/lib/guards";
import { ausenciaSchema } from "@/lib/validators/ausencia";
import { notificarAdmins, notificarUsuario } from "@/lib/notificaciones";

function dia(s: string) {
  const d = parseISO(s);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Empleado solicita una ausencia (queda PENDIENTE y avisa al administrador). */
export async function solicitarAusencia(raw: unknown): Promise<Resultado> {
  const u = await requireSesion();
  if (!u.empleadoId) return fallo("Tu cuenta no está vinculada a una ficha de empleado");
  const parsed = ausenciaSchema.safeParse(raw);
  if (!parsed.success) return fallo(parsed.error.errors[0]?.message ?? "Datos no válidos");
  const d = parsed.data;

  const emp = await prisma.empleado.findUnique({
    where: { id: u.empleadoId },
    select: { nombre: true, apellidos: true, saldoVacaciones: true },
  });

  // Límite de vacaciones: máximo 30 días solicitables por empleado y año.
  if (d.tipo === "VACACIONES") {
    const MAX_DIAS = Math.min(emp?.saldoVacaciones ?? 30, 30);
    const anio = parseISO(d.fechaInicio).getFullYear();
    const previas = await prisma.ausencia.findMany({
      where: {
        empleadoId: u.empleadoId,
        tipo: "VACACIONES",
        estado: { in: ["PENDIENTE", "APROBADA"] },
        fechaInicio: { gte: new Date(anio, 0, 1), lt: new Date(anio + 1, 0, 1) },
      },
    });
    const usados = previas.reduce(
      (acc, a) => acc + Math.round((a.fechaFin.getTime() - a.fechaInicio.getTime()) / 86400000) + 1,
      0
    );
    const solicitados =
      Math.round((parseISO(d.fechaFin).getTime() - parseISO(d.fechaInicio).getTime()) / 86400000) + 1;
    if (usados + solicitados > MAX_DIAS) {
      return fallo(
        `Superas el máximo de ${MAX_DIAS} días de vacaciones al año. Te quedan ${Math.max(0, MAX_DIAS - usados)} días.`
      );
    }
  }

  await prisma.ausencia.create({
    data: {
      empleadoId: u.empleadoId,
      tipo: d.tipo,
      estado: "PENDIENTE",
      fechaInicio: dia(d.fechaInicio),
      fechaFin: dia(d.fechaFin),
      motivo: d.motivo || null,
    },
  });

  await notificarAdmins(u.organizacionId, {
    tipo: d.tipo === "BAJA" ? "NUEVA_BAJA" : "SOLICITUD_VACACIONES",
    titulo: d.tipo === "BAJA" ? "Nueva baja registrada" : "Nueva solicitud de ausencia",
    cuerpo: `${emp?.nombre ?? "Un empleado"} ${emp?.apellidos ?? ""} solicita ${d.tipo.toLowerCase()} (${d.fechaInicio} → ${d.fechaFin}).`,
    enlace: "/vacaciones",
  });
  revalidatePath("/mis-vacaciones");
  revalidatePath("/vacaciones");
  return { ok: true };
}

/** Responsable registra una ausencia/baja directamente (queda APROBADA). */
export async function registrarAusencia(empleadoId: string, raw: unknown): Promise<Resultado> {
  const u = await requireResponsable();
  if (!(await empleadoEnAmbito(u, empleadoId))) return fallo("Empleado no encontrado");
  const parsed = ausenciaSchema.safeParse(raw);
  if (!parsed.success) return fallo(parsed.error.errors[0]?.message ?? "Datos no válidos");
  const d = parsed.data;

  await prisma.ausencia.create({
    data: {
      empleadoId,
      tipo: d.tipo,
      estado: "APROBADA",
      fechaInicio: dia(d.fechaInicio),
      fechaFin: dia(d.fechaFin),
      motivo: d.motivo || null,
      resueltoPorId: u.id,
      resueltoEn: new Date(),
    },
  });
  revalidatePath("/vacaciones");
  return { ok: true };
}

/** Responsable aprueba o rechaza una solicitud (avisa al administrador). */
export async function resolverAusencia(
  id: string,
  aprobar: boolean,
  comentario?: string
): Promise<Resultado> {
  const u = await requireResponsable();
  const ausencia = await prisma.ausencia.findUnique({
    where: { id },
    include: { empleado: { select: { id: true, nombre: true, apellidos: true, usuarioId: true } } },
  });
  if (!ausencia) return fallo("Solicitud no encontrada");
  if (!(await empleadoEnAmbito(u, ausencia.empleadoId))) return fallo("No permitido");

  await prisma.ausencia.update({
    where: { id },
    data: {
      estado: aprobar ? "APROBADA" : "RECHAZADA",
      comentarioResolucion: comentario || null,
      resueltoPorId: u.id,
      resueltoEn: new Date(),
    },
  });

  await notificarAdmins(u.organizacionId, {
    tipo: "RESOLUCION_VACACIONES",
    titulo: `Solicitud ${aprobar ? "aprobada" : "rechazada"}`,
    cuerpo: `La ausencia de ${ausencia.empleado.nombre} ${ausencia.empleado.apellidos ?? ""} ha sido ${aprobar ? "aprobada" : "rechazada"}.${comentario ? ` Comentario: ${comentario}` : ""}`,
    enlace: "/vacaciones",
  });

  // Aviso in-app al empleado afectado.
  if (ausencia.empleado.usuarioId) {
    await notificarUsuario(u.organizacionId, ausencia.empleado.usuarioId, {
      tipo: "RESOLUCION_VACACIONES",
      titulo: `Tu solicitud ha sido ${aprobar ? "aprobada" : "rechazada"}`,
      cuerpo: comentario || `Tu ${ausencia.tipo.toLowerCase()} ha sido ${aprobar ? "aprobada" : "rechazada"}.`,
      enlace: "/mis-vacaciones",
    });
  }
  revalidatePath("/vacaciones");
  return { ok: true };
}
