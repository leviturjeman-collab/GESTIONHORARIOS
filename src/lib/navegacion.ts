import {
  LayoutDashboard,
  Building2,
  CalendarRange,
  FileUp,
  Plane,
  Repeat,
  Clock,
  Euro,
  Users,
  FileText,
  Sparkles,
  Settings,
  CalendarDays,
  CalendarCheck,
  UserCircle,
  type LucideIcon,
} from "lucide-react";
import { Rol } from "@/lib/enums";

export type ItemNav = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const NAV_RESPONSABLE_ADMIN: ItemNav[] = [
  { href: "/inicio", label: "Inicio", icon: LayoutDashboard },
  { href: "/ubicaciones", label: "Ubicaciones", icon: Building2 },
  { href: "/onboarding", label: "Insertar cuadrante", icon: FileUp },
  { href: "/cuadrantes", label: "Cuadrantes", icon: CalendarRange },
  { href: "/vacaciones", label: "Vacaciones y ausencias", icon: Plane },
  { href: "/cambios", label: "Cambios de turno", icon: Repeat },
  { href: "/fichaje", label: "Fichaje", icon: Clock },
  { href: "/empleados", label: "Empleados", icon: Users },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

const NAV_MANAGER: ItemNav[] = [
  { href: "/inicio", label: "Inicio", icon: LayoutDashboard },
  { href: "/onboarding", label: "Insertar cuadrante", icon: FileUp },
  { href: "/cuadrantes", label: "Cuadrantes", icon: CalendarRange },
  { href: "/vacaciones", label: "Vacaciones y ausencias", icon: Plane },
  { href: "/cambios", label: "Cambios de turno", icon: Repeat },
  { href: "/fichaje", label: "Fichaje", icon: Clock },
  { href: "/empleados", label: "Empleados", icon: Users },
];

const NAV_EMPLEADO: ItemNav[] = [
  { href: "/fichar", label: "Fichar", icon: Clock },
  { href: "/mi-cuadrante", label: "Mi cuadrante", icon: CalendarDays },
  { href: "/mi-disponibilidad", label: "Mi disponibilidad", icon: CalendarCheck },
  { href: "/mis-vacaciones", label: "Mis vacaciones", icon: Plane },
  { href: "/cambios", label: "Cambios de turno", icon: Repeat },
  { href: "/mi-perfil", label: "Mi perfil", icon: UserCircle },
];

export function navPorRol(rol: string): ItemNav[] {
  if (rol === Rol.ADMIN) return NAV_RESPONSABLE_ADMIN;
  if (rol === Rol.MANAGER) return NAV_MANAGER;
  return NAV_EMPLEADO;
}
