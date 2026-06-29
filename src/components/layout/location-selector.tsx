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
import { Button } from "@/components/ui/button";

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
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-9 w-[200px] justify-between px-3">
          <div className="flex items-center gap-2 truncate">
            <Building2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{nombreActual}</span>
          </div>
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Ubicación</DropdownMenuLabel>
        {permitirTodas && (
          <>
            <DropdownMenuItem onSelect={() => seleccionar("todas")}>
              Todas las ubicaciones
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {ubicaciones.map((u) => (
          <DropdownMenuItem key={u.id} onSelect={() => seleccionar(u.id)}>
            {u.nombre}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
