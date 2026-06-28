"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSesion } from "@/lib/session";
import { requireResponsable, empleadoEnAmbito, fallo, type Resultado } from "@/lib/guards";
import { notificarAdmins, notificarUsuario } from "@/lib/notificaciones";

/** Empleado ofrece/propone cambiar uno de sus turnos a un compañero. */
export async function proponerCambio(
  turnoId: string,
  destinoId: string,
  mensaje: string
): Promise<Resultado> {
  const u = await requireSesion();
  if (!u.empleadoId) return fallo("Tu cuenta no está vinculada a una ficha de empleado");
  const turno = await prisma.turno.findUnique({ where: { id: turnoId } });
  if (!turno || turno.empleadoId !== u.empleadoId) return fallo("Ese turno no es tuyo");

  await prisma.cambioTurno.create({
    data: {
      turnoOrigenId: turnoId,
      solicitanteId: u.empleadoId,
      destinoId,
      estado: "PROPUESTO",
      mensaje: mensaje || null,
    },
  });
  await notificarAdmins(u.organizacionId, {
    tipo: "CAMBIO_TURNO",
    titulo: "Nueva propuesta de cambio de turno",
    cuerpo: "Un empleado ha propuesto un cambio de turno a un compañero.",
    enlace: "/cambios",
  });
  revalidatePath("/cambios");
  return { ok: true };
}

/** El compañero (destino) acepta o rechaza la propuesta. */
export async function responderCambio(id: string, aceptar: boolean): Promise<Resultado> {
  const u = await requireSesion();
  const cambio = await prisma.cambioTurno.findUnique({
    where: { id },
    include: { turnoOrigen: { include: { cuadrante: true } } },
  });
  if (!cambio || cambio.destinoId !== u.empleadoId) return fallo("Propuesta no encontrada");
  if (cambio.estado !== "PROPUESTO") return fallo("La propuesta ya no está disponible");

  if (!aceptar) {
    await prisma.cambioTurno.update({ where: { id }, data: { estado: "RECHAZADO" } });
    revalidatePath("/cambios");
    return { ok: true };
  }

  const ubic = await prisma.ubicacion.findUnique({
    where: { id: cambio.turnoOrigen.cuadrante.ubicacionId },
    select: { requiereAprobacionCambios: true },
  });

  if (ubic?.requiereAprobacionCambios) {
    await prisma.cambioTurno.update({ where: { id }, data: { estado: "PENDIENTE_APROBACION" } });
    await notificarAdmins(u.organizacionId, {
      tipo: "CAMBIO_TURNO",
      titulo: "Cambio de turno pendiente de aprobación",
      cuerpo: "Un cambio de turno aceptado entre empleados espera tu aprobación.",
      enlace: "/cambios",
    });
  } else {
    await confirmarSwap(id);
    await notificarAdmins(u.organizacionId, {
      tipo: "CAMBIO_TURNO",
      titulo: "Cambio de turno confirmado",
      cuerpo: "Un cambio de turno se ha confirmado y aplicado al cuadrante.",
      enlace: "/cambios",
    });
  }
  revalidatePath("/cambios");
  revalidatePath("/cuadrantes");
  return { ok: true };
}

/** El responsable aprueba o rechaza un cambio pendiente. */
export async function aprobarCambio(id: string, aprobar: boolean): Promise<Resultado> {
  const u = await requireResponsable();
  const cambio = await prisma.cambioTurno.findUnique({
    where: { id },
    include: { turnoOrigen: { include: { cuadrante: true } } },
  });
  if (!cambio) return fallo("Cambio no encontrado");
  if (!(await empleadoEnAmbito(u, cambio.solicitanteId))) return fallo("No permitido");

  if (!aprobar) {
    await prisma.cambioTurno.update({ where: { id }, data: { estado: "RECHAZADO", aprobadoPorId: u.id } });
  } else {
    await confirmarSwap(id, u.id);
  }
  revalidatePath("/cambios");
  revalidatePath("/cuadrantes");
  return { ok: true };
}

/** Reasigna el turno al destino y marca el cambio como CONFIRMADO. */
async function confirmarSwap(id: string, aprobadoPorId?: string) {
  const cambio = await prisma.cambioTurno.findUnique({
    where: { id },
    include: {
      solicitante: { select: { organizacionId: true, usuarioId: true } },
      destino: { select: { usuarioId: true } },
    },
  });
  if (!cambio || !cambio.destinoId) return;
  await prisma.$transaction([
    prisma.turno.update({
      where: { id: cambio.turnoOrigenId },
      data: { empleadoId: cambio.destinoId },
    }),
    prisma.cambioTurno.update({
      where: { id },
      data: { estado: "CONFIRMADO", aprobadoPorId: aprobadoPorId ?? null },
    }),
  ]);

  // Aviso in-app a ambos empleados.
  const orgId = cambio.solicitante.organizacionId;
  const aviso = {
    tipo: "CAMBIO_TURNO" as const,
    titulo: "Cambio de turno confirmado",
    cuerpo: "El intercambio se ha aplicado al cuadrante.",
    enlace: "/cambios",
  };
  if (cambio.solicitante.usuarioId) await notificarUsuario(orgId, cambio.solicitante.usuarioId, aviso);
  if (cambio.destino?.usuarioId) await notificarUsuario(orgId, cambio.destino.usuarioId, aviso);
}
