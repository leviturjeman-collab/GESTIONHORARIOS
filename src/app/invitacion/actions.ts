"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { aceptarInvitacionSchema } from "@/lib/validators/auth";
import { fallo, type Resultado } from "@/lib/guards";

export async function aceptarInvitacion(raw: unknown): Promise<Resultado> {
  const parsed = aceptarInvitacionSchema.safeParse(raw);
  if (!parsed.success) return fallo(parsed.error.errors[0]?.message ?? "Datos no válidos");
  const { token, password } = parsed.data;

  const usuario = await prisma.usuario.findUnique({ where: { tokenInvitacion: token } });
  if (!usuario) return fallo("Invitación no válida");
  if (usuario.invitacionExpira && usuario.invitacionExpira < new Date())
    return fallo("La invitación ha caducado. Pide una nueva a tu responsable.");

  const hash = await bcrypt.hash(password, 10);
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { passwordHash: hash, activo: true, tokenInvitacion: null, invitacionExpira: null },
  });
  await prisma.empleado.updateMany({
    where: { usuarioId: usuario.id },
    data: { estado: "ACTIVO" },
  });
  return { ok: true };
}
