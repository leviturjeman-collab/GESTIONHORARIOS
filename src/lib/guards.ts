import { prisma } from "@/lib/prisma";
import { requireSesion, ubicacionesAccesibles } from "@/lib/session";
import { esResponsable, esAdmin } from "@/lib/rbac";

/** Resultado uniforme para server actions. */
export type Resultado<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export function fallo(error: string): Resultado<never> {
  return { ok: false, error };
}

/** Exige sesión de responsable (admin o manager). Lanza redirección si no hay sesión. */
export async function requireResponsable() {
  const u = await requireSesion();
  if (!esResponsable(u)) throw new Error("No autorizado");
  return u;
}

export async function requireAdmin() {
  const u = await requireSesion();
  if (!esAdmin(u)) throw new Error("No autorizado");
  return u;
}

/** Comprueba que el usuario puede operar sobre la ubicación dada. */
export async function puedeUbicacion(
  u: { id: string; rol: string; organizacionId: string },
  ubicacionId: string
): Promise<boolean> {
  const ids = await ubicacionesAccesibles({
    id: u.id,
    rol: u.rol,
    organizacionId: u.organizacionId,
    nombre: "",
    email: "",
    empleadoId: null,
  });
  return ids.includes(ubicacionId);
}

/** Verifica que un empleado pertenece al ámbito del usuario. */
export async function empleadoEnAmbito(
  u: { id: string; rol: string; organizacionId: string },
  empleadoId: string
): Promise<boolean> {
  const emp = await prisma.empleado.findUnique({
    where: { id: empleadoId },
    select: { ubicacionId: true, organizacionId: true },
  });
  if (!emp || emp.organizacionId !== u.organizacionId) return false;
  if (esAdmin(u)) return true;
  return emp.ubicacionId ? puedeUbicacion(u, emp.ubicacionId) : false;
}
