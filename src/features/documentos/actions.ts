"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireResponsable, empleadoEnAmbito, fallo, type Resultado } from "@/lib/guards";
import { guardarArchivo } from "@/lib/storage";

const TIPOS = ["CONTRATO", "NOMINA", "JUSTIFICANTE"];

/** Sube un documento (PDF) de un empleado y lo guarda en disco. */
export async function subirDocumento(formData: FormData): Promise<Resultado> {
  const u = await requireResponsable();
  const empleadoId = String(formData.get("empleadoId") ?? "");
  const tipo = String(formData.get("tipo") ?? "");
  const file = formData.get("archivo");

  if (!TIPOS.includes(tipo)) return fallo("Tipo de documento no válido");
  if (!(await empleadoEnAmbito(u, empleadoId))) return fallo("Empleado no encontrado");
  if (!(file instanceof File) || file.size === 0) return fallo("Selecciona un archivo");
  if (file.size > 10 * 1024 * 1024) return fallo("El archivo supera los 10 MB");

  const nombreSeguro = `${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
  const ruta = `${empleadoId}/${nombreSeguro}`;
  await guardarArchivo(ruta, Buffer.from(await file.arrayBuffer()), file.type || "application/octet-stream");

  await prisma.documento.create({
    data: {
      empleadoId,
      tipo,
      nombre: file.name,
      ruta,
      restringido: tipo === "JUSTIFICANTE", // datos de salud → acceso restringido
      subidoPorId: u.id,
    },
  });
  revalidatePath("/nominas");
  return { ok: true };
}

export async function eliminarDocumento(id: string): Promise<Resultado> {
  const u = await requireResponsable();
  const doc = await prisma.documento.findUnique({ where: { id } });
  if (!doc || !(await empleadoEnAmbito(u, doc.empleadoId))) return fallo("No permitido");
  await prisma.documento.delete({ where: { id } });
  revalidatePath("/nominas");
  return { ok: true };
}
