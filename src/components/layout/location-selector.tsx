"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  const customText = actual === "todas" ? "Todas las ubicaciones" : ubicaciones.find(u => u.id === actual)?.nombre ?? "Ubicación";

  return (
    <Select value={actual} onValueChange={seleccionar}>
      <SelectTrigger className="h-9 w-[220px] bg-card hover:bg-muted font-medium shadow-sm border-input">
        <div className="flex items-center gap-2 truncate">
          <Building2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{customText}</span>
        </div>
      </SelectTrigger>
      <SelectContent align="start">
        {permitirTodas && (
          <SelectItem value="todas">
            Todas las ubicaciones
          </SelectItem>
        )}
        {ubicaciones.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            {u.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
