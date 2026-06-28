"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireResponsable, puedeUbicacion, fallo, type Resultado } from "@/lib/guards";

/** Activa/desactiva la regla "los cambios de turno requieren aprobación" por ubicación. */
export async function toggleAprobacion(
  ubicacionId: string,
  valor: boolean
): Promise<Resultado> {
  const u = await requireResponsable();
  if (!(await puedeUbicacion(u, ubicacionId))) return fallo("No permitido");
  await prisma.ubicacion.update({
    where: { id: ubicacionId },
    data: { requiereAprobacionCambios: valor },
  });
  revalidatePath("/ajustes");
  return { ok: true };
}
