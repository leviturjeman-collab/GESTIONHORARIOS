"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Building2, ChevronDown } from "lucide-react";

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

  const actual =
    params.get("ubicacion") ?? (permitirTodas ? "todas" : ubicaciones[0]?.id ?? "todas");

  function seleccionar(id: string) {
    const p = new URLSearchParams(params.toString());
    if (id === "todas") p.delete("ubicacion");
    else p.set("ubicacion", id);
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="relative">
      <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <select
        value={actual}
        onChange={(e) => seleccionar(e.target.value)}
        className="h-9 w-[220px] appearance-none rounded-md border border-input bg-card pl-9 pr-8 text-sm font-medium shadow-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
      >
        {permitirTodas && <option value="todas">Todas las ubicaciones</option>}
        {ubicaciones.map((u) => (
          <option key={u.id} value={u.id}>
            {u.nombre}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground opacity-50" />
    </div>
  );
}
