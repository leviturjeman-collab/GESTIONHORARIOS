"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Building2, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const actual =
    params.get("ubicacion") ?? (permitirTodas ? "todas" : ubicaciones[0]?.id ?? "todas");

  function seleccionar(id: string) {
    const p = new URLSearchParams(params.toString());
    if (id === "todas") p.delete("ubicacion");
    else p.set("ubicacion", id);
    router.push(`${pathname}?${p.toString()}`);
    setIsOpen(false);
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const nombreActual =
    actual === "todas"
      ? "Todas las ubicaciones"
      : ubicaciones.find((u) => u.id === actual)?.nombre ?? "Ubicación";

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 w-[220px] items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-sm font-medium shadow-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <div className="flex items-center gap-2 truncate">
          <Building2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{nombreActual}</span>
        </div>
        <ChevronDown className="size-4 shrink-0 opacity-50" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-1 max-h-96 min-w-[220px] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md animate-in fade-in-80 slide-in-from-top-2">
          <div className="flex w-full flex-col p-1">
            {permitirTodas && (
              <button
                onClick={() => seleccionar("todas")}
                className={cn(
                  "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                  actual === "todas" && "bg-accent text-accent-foreground font-medium"
                )}
              >
                {actual === "todas" && (
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <Check className="size-4" />
                  </span>
                )}
                Todas las ubicaciones
              </button>
            )}

            {permitirTodas && ubicaciones.length > 0 && (
              <div className="my-1 h-px bg-muted" />
            )}

            {ubicaciones.map((u) => (
              <button
                key={u.id}
                onClick={() => seleccionar(u.id)}
                className={cn(
                  "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                  actual === u.id && "bg-accent text-accent-foreground font-medium"
                )}
              >
                {actual === u.id && (
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <Check className="size-4" />
                  </span>
                )}
                <span className="truncate">{u.nombre}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
