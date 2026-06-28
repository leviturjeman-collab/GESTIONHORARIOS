"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { parseISO, addWeeks, format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { lunesDeSemana } from "@/lib/fechas";

export function WeekSelector({ semanaISO }: { semanaISO: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const lunes = lunesDeSemana(parseISO(semanaISO));

  function ir(nuevoLunes: Date) {
    const p = new URLSearchParams(params.toString());
    p.set("semana", format(nuevoLunes, "yyyy-MM-dd"));
    router.push(`${pathname}?${p.toString()}`);
  }

  const domingo = addWeeks(lunes, 0);
  const fin = new Date(lunes);
  fin.setDate(fin.getDate() + 6);

  return (
    <div className="flex items-center gap-1 rounded-md border border-input bg-card p-0.5 shadow-sm">
      <Button variant="ghost" size="icon" className="size-8" onClick={() => ir(addWeeks(lunes, -1))}>
        <ChevronLeft />
      </Button>
      <button
        onClick={() => ir(lunesDeSemana())}
        className="flex items-center gap-2 px-2 text-sm font-medium tabular-nums"
        title="Ir a la semana actual"
      >
        <CalendarDays className="size-4 text-muted-foreground" />
        {format(lunes, "d MMM", { locale: es })} – {format(fin, "d MMM", { locale: es })}
      </button>
      <Button variant="ghost" size="icon" className="size-8" onClick={() => ir(addWeeks(lunes, 1))}>
        <ChevronRight />
      </Button>
    </div>
  );
}
