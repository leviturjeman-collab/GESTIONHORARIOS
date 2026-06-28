import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getSesion } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { esAdmin, esManager } from "@/lib/rbac";
import { puedeUbicacion } from "@/lib/guards";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const u = await getSesion();
  if (!u) return new Response("No autorizado", { status: 401 });

  const doc = await prisma.documento.findUnique({
    where: { id: params.id },
    include: { empleado: { select: { usuarioId: true, ubicacionId: true, organizacionId: true } } },
  });
  if (!doc || doc.empleado.organizacionId !== u.organizacionId)
    return new Response("No encontrado", { status: 404 });

  const esPropietario = doc.empleado.usuarioId === u.id;
  let permitido = esAdmin(u) || esPropietario;
  // Manager: documentos NO restringidos de su ámbito (los justificantes de baja
  // —datos de salud— quedan reservados a admin y al propio empleado).
  if (!permitido && esManager(u) && !doc.restringido && doc.empleado.ubicacionId) {
    permitido = await puedeUbicacion(u, doc.empleado.ubicacionId);
  }
  if (!permitido) return new Response("Prohibido", { status: 403 });

  try {
    const buf = await readFile(path.join(process.cwd(), doc.ruta));
    const esPdf = doc.nombre.toLowerCase().endsWith(".pdf");
    return new Response(buf, {
      headers: {
        "Content-Type": esPdf ? "application/pdf" : "application/octet-stream",
        "Content-Disposition": `inline; filename="${doc.nombre}"`,
      },
    });
  } catch {
    return new Response("Archivo no disponible", { status: 404 });
  }
}
