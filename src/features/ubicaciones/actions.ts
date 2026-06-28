"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, fallo, type Resultado } from "@/lib/guards";
import { ubicacionSchema } from "@/lib/validators/ubicacion";

export async function crearUbicacion(raw: unknown): Promise<Resultado<{ id: string }>> {
  const u = await requireAdmin();
  const parsed = ubicacionSchema.safeParse(raw);
  if (!parsed.success) return fallo(parsed.error.errors[0]?.message ?? "Datos no válidos");
  const d = parsed.data;

  const ubicAjustes = {
    horarioCustom: d.horarioCustom || null,
  };

  const ubic = await prisma.ubicacion.create({
    data: {
      organizacionId: u.organizacionId,
      nombre: d.nombre,
      direccion: d.direccion || null,
      horaApertura: d.horarioCustom?.aperturaSemana || d.horaApertura,
      horaCierre: d.horarioCustom?.cierreSemana || d.horaCierre,
      requiereAprobacionCambios: d.requiereAprobacionCambios,
      ajustes: JSON.stringify(ubicAjustes),
      managers: d.managerId ? { connect: { id: d.managerId } } : undefined,
    },
  });
  revalidatePath("/ubicaciones");
  return { ok: true, data: { id: ubic.id } };
}

export async function actualizarUbicacion(id: string, raw: unknown): Promise<Resultado> {
  const u = await requireAdmin();
  const parsed = ubicacionSchema.safeParse(raw);
  if (!parsed.success) return fallo(parsed.error.errors[0]?.message ?? "Datos no válidos");
  const d = parsed.data;

  const existente = await prisma.ubicacion.findFirst({
    where: { id, organizacionId: u.organizacionId },
    include: { managers: { select: { id: true } } },
  });
  if (!existente) return fallo("Ubicación no encontrada");

  const ubicAjustes = existente.ajustes ? JSON.parse(existente.ajustes) : {};
  ubicAjustes.horarioCustom = d.horarioCustom || null;

  await prisma.ubicacion.update({
    where: { id },
    data: {
      nombre: d.nombre,
      direccion: d.direccion || null,
      horaApertura: d.horarioCustom?.aperturaSemana || d.horaApertura,
      horaCierre: d.horarioCustom?.cierreSemana || d.horaCierre,
      requiereAprobacionCambios: d.requiereAprobacionCambios,
      ajustes: JSON.stringify(ubicAjustes),
      managers: d.managerId
        ? {
            disconnect: existente.managers.map((m) => ({ id: m.id })),
            connect: { id: d.managerId },
          }
        : { disconnect: existente.managers.map((m) => ({ id: m.id })) },
    },
  });
  revalidatePath("/ubicaciones");
  return { ok: true };
}

export async function toggleActivaUbicacion(id: string, activa: boolean): Promise<Resultado> {
  const u = await requireAdmin();
  const ubic = await prisma.ubicacion.findFirst({
    where: { id, organizacionId: u.organizacionId },
  });
  if (!ubic) return fallo("Ubicación no encontrada");
  await prisma.ubicacion.update({ where: { id }, data: { activa } });
  revalidatePath("/ubicaciones");
  return { ok: true };
}

export async function eliminarUbicacion(id: string): Promise<Resultado> {
  const u = await requireAdmin();
  const existente = await prisma.ubicacion.findFirst({
    where: { id, organizacionId: u.organizacionId },
  });
  if (!existente) return fallo("Ubicación no encontrada");

  await prisma.ubicacion.delete({ where: { id } });
  revalidatePath("/ubicaciones");
  return { ok: true };
}
