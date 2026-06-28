"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSesion } from "@/lib/session";
import type { Resultado } from "@/lib/guards";

export async function marcarTodasLeidas(): Promise<Resultado> {
  const u = await requireSesion();
  await prisma.notificacion.updateMany({
    where: { destinatarioId: u.id, leida: false },
    data: { leida: true },
  });
  revalidatePath("/notificaciones");
  return { ok: true };
}

export async function marcarLeida(id: string): Promise<Resultado> {
  const u = await requireSesion();
  await prisma.notificacion.updateMany({
    where: { id, destinatarioId: u.id },
    data: { leida: true },
  });
  revalidatePath("/notificaciones");
  return { ok: true };
}
