"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireResponsable, puedeUbicacion, fallo, type Resultado } from "@/lib/guards";
import { ROLES_FUNCIONALES } from "@/lib/enums";

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:mm");
const coberturaSchema = z.object({
  rol: z.enum(ROLES_FUNCIONALES),
  diaSemana: z.coerce.number().int().min(-1).max(6), // -1 = todos los días
  franjaInicio: hora,
  franjaFin: hora,
  minPersonas: z.coerce.number().int().min(1).max(20),
});

export async function añadirCobertura(ubicacionId: string, raw: unknown): Promise<Resultado> {
  const u = await requireResponsable();
  if (!(await puedeUbicacion(u, ubicacionId))) return fallo("No permitido");
  const parsed = coberturaSchema.safeParse(raw);
  if (!parsed.success) return fallo(parsed.error.errors[0]?.message ?? "Datos no válidos");
  const d = parsed.data;
  await prisma.coberturaMinima.create({
    data: {
      ubicacionId,
      rol: d.rol,
      diaSemana: d.diaSemana < 0 ? null : d.diaSemana,
      franjaInicio: d.franjaInicio,
      franjaFin: d.franjaFin,
      minPersonas: d.minPersonas,
    },
  });
  revalidatePath("/ubicaciones");
  revalidatePath("/cuadrantes");
  return { ok: true };
}

export async function eliminarCobertura(id: string): Promise<Resultado> {
  const u = await requireResponsable();
  const cob = await prisma.coberturaMinima.findUnique({ where: { id } });
  if (!cob || !(await puedeUbicacion(u, cob.ubicacionId))) return fallo("No permitido");
  await prisma.coberturaMinima.delete({ where: { id } });
  revalidatePath("/ubicaciones");
  revalidatePath("/cuadrantes");
  return { ok: true };
}
