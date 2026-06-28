import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export function KpiCard({
  etiqueta,
  valor,
  icon: Icon,
  tono = "default",
  sub,
}: {
  etiqueta: string;
  valor: string;
  icon?: LucideIcon;
  tono?: "default" | "success" | "warning" | "danger" | "accent";
  sub?: string;
}) {
  const tonos: Record<string, string> = {
    default: "text-primary bg-primary/10",
    success: "text-success bg-success-soft",
    warning: "text-warning-foreground bg-warning-soft",
    danger: "text-danger bg-danger-soft",
    accent: "text-accent bg-accent/10",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{etiqueta}</p>
          <p className="kpi-cifra mt-1">{valor}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
        {Icon && (
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg",
              tonos[tono]
            )}
          >
            <Icon className="size-5" />
          </div>
        )}
      </div>
    </Card>
  );
}
