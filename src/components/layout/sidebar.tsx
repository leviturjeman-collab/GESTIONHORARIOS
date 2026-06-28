"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { navPorRol } from "@/lib/navegacion";
import { cn } from "@/lib/utils";

export function Sidebar({ rol }: { rol: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ubicacion = searchParams.get("ubicacion");
  const items = navPorRol(rol);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <CalendarClock className="size-5" />
        </div>
        <span className="text-base font-semibold tracking-tight">Gestión Horarios</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const Icon = item.icon;
          const activo =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const targetHref = ubicacion ? `${item.href}?ubicacion=${ubicacion}` : item.href;
          return (
            <Link
              key={item.href}
              href={targetHref}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                activo
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-[18px] shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3 text-xs text-muted-foreground">
        <p className="px-2">v1.0 · Fase MVP</p>
      </div>
    </aside>
  );
}
