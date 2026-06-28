import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Avatar con iniciales y color sólido. (No usamos imágenes en v1; un avatar de
 * iniciales coloreado por rol es suficiente y rinde mejor en vistas densas.)
 */
export function Avatar({
  nombre,
  color,
  size = 32,
  className,
}: {
  nombre: string;
  color?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: color ?? "hsl(var(--primary))",
        fontSize: size * 0.4,
      }}
      aria-hidden
    >
      {nombre}
    </span>
  );
}
