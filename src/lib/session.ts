import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { esAdmin } from "@/lib/rbac";

export type UsuarioSesion = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  organizacionId: string;
  empleadoId: string | null;
};

/** Usuario de la sesión actual (o null). */
export async function getSesion(): Promise<UsuarioSesion | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    nombre: session.user.name ?? "",
    email: session.user.email ?? "",
    rol: session.user.rol,
    organizacionId: session.user.organizacionId,
    empleadoId: session.user.empleadoId ?? null,
  };
}

/** Igual que getSesion pero redirige a /login si no hay sesión. */
export async function requireSesion(): Promise<UsuarioSesion> {
  const u = await getSesion();
  if (!u) redirect("/login");
  return u;
}

/** IDs de las ubicaciones que el usuario puede ver/gestionar. */
export async function ubicacionesAccesibles(u: UsuarioSesion): Promise<string[]> {
  if (esAdmin(u)) {
    const todas = await prisma.ubicacion.findMany({
      where: { organizacionId: u.organizacionId },
      select: { id: true },
    });
    return todas.map((x) => x.id);
  }
  // Manager: solo las gestionadas. Empleado: la de su ficha.
  const usuario = await prisma.usuario.findUnique({
    where: { id: u.id },
    select: {
      ubicacionesGestionadas: { select: { id: true } },
      empleado: { select: { ubicacionId: true } },
    },
  });
  if (!usuario) return [];
  if (usuario.empleado?.ubicacionId) return [usuario.empleado.ubicacionId];
  return usuario.ubicacionesGestionadas.map((x) => x.id);
}

/**
 * Resuelve el ámbito de ubicaciones de una página a partir del parámetro
 * ?ubicacion= de la URL: si es válido y accesible, devuelve solo esa; si no,
 * todas las accesibles.
 */
export async function resolverAmbito(
  u: UsuarioSesion,
  ubicacionParam?: string | null
): Promise<string[]> {
  const accesibles = await ubicacionesAccesibles(u);
  if (ubicacionParam && accesibles.includes(ubicacionParam)) return [ubicacionParam];
  return accesibles;
}

/** Contexto completo para el shell: usuario + ubicaciones accesibles. */
export async function getContexto(u: UsuarioSesion) {
  const ids = await ubicacionesAccesibles(u);
  const ubicaciones = await prisma.ubicacion.findMany({
    where: { id: { in: ids } },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
  const noLeidas = await prisma.notificacion.count({
    where: { destinatarioId: u.id, leida: false },
  });
  return { ubicaciones, noLeidas };
}
