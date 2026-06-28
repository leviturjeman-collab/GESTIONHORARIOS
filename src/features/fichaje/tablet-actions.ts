"use server";

import { prisma } from "@/lib/prisma";
import { requireResponsable, fallo, type Resultado } from "@/lib/guards";
import { ficharEntrada, ficharSalida } from "@/features/fichaje/actions";

/**
 * Fichaje en modo tablet (dispositivo compartido del local): el responsable
 * abre la tablet y cada empleado ficha con su PIN. Alterna entrada/salida.
 */
export async function ficharConPin(
  empleadoId: string,
  pin: string,
  lat?: number,
  lng?: number
): Promise<Resultado<{ accion: "entrada" | "salida"; nombre: string }>> {
  const u = await requireResponsable();
  const emp = await prisma.empleado.findUnique({
    where: { id: empleadoId },
    select: { pinFichaje: true, organizacionId: true, nombre: true },
  });
  if (!emp || emp.organizacionId !== u.organizacionId) return fallo("Empleado no encontrado");
  if (!emp.pinFichaje || emp.pinFichaje !== pin.trim()) return fallo("PIN incorrecto");

  const abierto = await prisma.fichaje.findFirst({ where: { empleadoId, salida: null } });
  const res = abierto
    ? await ficharSalida({ empleadoId, lat, lng })
    : await ficharEntrada({ empleadoId, lat, lng });
  if (!res.ok) return res;
  return { ok: true, data: { accion: abierto ? "salida" : "entrada", nombre: emp.nombre } };
}
