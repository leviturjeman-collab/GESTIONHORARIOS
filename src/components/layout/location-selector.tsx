"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Building2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type Ubic = { id: string; nombre: string };

export function LocationSelector({
  ubicaciones,
  permitirTodas,
}: {
  ubicaciones: Ubic[];
  permitirTodas: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // La ubicación activa vive en la URL (?ubicacion=). Por defecto: "todas"
  // para quien puede verlas todas, o la primera ubicación accesible.
  const actual =
    params.get("ubicacion") ?? (permitirTodas ? "todas" : ubicaciones[0]?.id ?? "todas");

  function seleccionar(id: string) {
    const p = new URLSearchParams(params.toString());
    if (id === "todas") p.delete("ubicacion");
    else p.set("ubicacion", id);
    router.push(`${pathname}?${p.toString()}`);
  }

  const nombreActual =
    actual === "todas"
      ? "Todas las ubicaciones"
      : ubicaciones.find((u) => u.id === actual)?.nombre ?? "Ubicación";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-9 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-medium shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Building2 className="size-4 text-muted-foreground" />
        <span className="max-w-[12rem] truncate">{nombreActual}</span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Ubicación</DropdownMenuLabel>
        {permitirTodas && (
          <>
            <DropdownMenuItem onClick={() => seleccionar("todas")}>
              Todas las ubicaciones
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {ubicaciones.map((u) => (
          <DropdownMenuItem key={u.id} onClick={() => seleccionar(u.id)}>
            {u.nombre}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
