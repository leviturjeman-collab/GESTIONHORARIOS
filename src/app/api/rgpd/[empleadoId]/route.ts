import { NextRequest } from "next/server";
import { getSesion } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { esAdmin } from "@/lib/rbac";

/**
 * RGPD — derecho de acceso: exporta TODOS los datos del empleado en JSON.
 * Acceso: administrador o el propio empleado.
 */
export async function GET(_req: NextRequest, { params }: { params: { empleadoId: string } }) {
  const u = await getSesion();
  if (!u) return new Response("No autorizado", { status: 401 });

  const emp = await prisma.empleado.findUnique({
    where: { id: params.empleadoId },
    include: {
      contrato: true,
      turnos: true,
      ausencias: true,
      fichajes: true,
      disponibilidades: true,
      documentos: { select: { id: true, tipo: true, nombre: true, restringido: true, creadoEn: true } },
      usuario: { select: { email: true, nombre: true, rol: true } },
    },
  });
  if (!emp || emp.organizacionId !== u.organizacionId)
    return new Response("No encontrado", { status: 404 });

  if (!esAdmin(u) && emp.usuarioId !== u.id)
    return new Response("Prohibido", { status: 403 });

  const data = { exportadoEn: new Date().toISOString(), empleado: emp };
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="rgpd-${emp.nombre}-${emp.id}.json"`,
    },
  });
}
