import { Rol } from "@/lib/enums";

/**
 * Control de acceso por rol (RBAC). La matriz de permisos de la spec se traduce
 * en estas comprobaciones, usadas en server actions, route handlers y UI.
 */

export type SesionUsuario = {
  id: string;
  rol: string;
  organizacionId: string;
  empleadoId?: string | null;
  ubicacionesGestionadas?: string[];
};

export function esAdmin(u?: { rol: string } | null): boolean {
  return u?.rol === Rol.ADMIN;
}
export function esManager(u?: { rol: string } | null): boolean {
  return u?.rol === Rol.MANAGER;
}
export function esEmpleado(u?: { rol: string } | null): boolean {
  return u?.rol === Rol.EMPLEADO;
}
export function esResponsable(u?: { rol: string } | null): boolean {
  return esAdmin(u) || esManager(u);
}

/** ¿Puede el usuario operar sobre una ubicación concreta? */
export function puedeAccederUbicacion(u: SesionUsuario, ubicacionId: string): boolean {
  if (esAdmin(u)) return true;
  if (esManager(u)) return (u.ubicacionesGestionadas ?? []).includes(ubicacionId);
  return false;
}

/** Capacidades de alto nivel (para mostrar/ocultar acciones y navegación). */
export const permisos = {
  gestionarUbicaciones: esAdmin,
  importarExcel: esResponsable,
  editarCuadrante: esResponsable,
  generarCuadranteIA: esResponsable,
  gestionarPlantillas: esResponsable,
  aprobarAusencias: esResponsable,
  solicitarAusencias: (u: { rol: string }) => true, // todos
  aprobarCambiosTurno: esResponsable,
  proponerCambioTurno: esEmpleado,
  declararDisponibilidad: esEmpleado,
  fichar: esEmpleado,
  verCostes: esResponsable,
  gestionarDocumentos: esAdmin,
  configurarReglas: esResponsable,
};

/** Rutas iniciales por rol tras el login. */
export function rutaInicial(rol: string): string {
  if (rol === Rol.EMPLEADO) return "/fichar";
  return "/inicio";
}
