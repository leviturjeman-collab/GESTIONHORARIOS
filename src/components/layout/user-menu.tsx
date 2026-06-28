"use client";

import { signOut } from "next-auth/react";
import { LogOut, UserCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/ui/avatar";
import { iniciales } from "@/lib/utils";

const ETIQUETA_ROL: Record<string, string> = {
  ADMIN: "Administrador",
  MANAGER: "Manager",
  EMPLEADO: "Empleado",
};

export function UserMenu({
  nombre,
  email,
  rol,
}: {
  nombre: string;
  email: string;
  rol: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar nombre={iniciales(nombre)} size={34} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <div className="text-sm font-medium text-foreground">{nombre}</div>
          <div className="text-xs text-muted-foreground">{email}</div>
          <div className="mt-1 text-xs text-primary">{ETIQUETA_ROL[rol] ?? rol}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/mi-perfil">
            <UserCircle /> Mi perfil
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
