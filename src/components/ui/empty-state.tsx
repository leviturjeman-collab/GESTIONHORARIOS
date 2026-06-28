import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Estado vacío reutilizable: icono, explicación y acción principal.
 * (Patrón requerido por la spec para listas/tableros sin datos.)
 */
export function EmptyState({
  icon: Icon,
  titulo,
  descripcion,
  children,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  titulo: string;
  descripcion?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-12 text-center",
        className
      )}
    >
      {Icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
          <Icon className="size-6 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-base font-semibold">{titulo}</h3>
      {descripcion && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{descripcion}</p>
      )}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
