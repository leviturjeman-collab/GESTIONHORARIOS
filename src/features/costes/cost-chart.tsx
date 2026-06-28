"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { euros } from "@/lib/utils";

export function CostChart({
  datos,
  costeTotal,
}: {
  datos: { dia: string; coste: number }[];
  costeTotal: number;
}) {
  const [venta, setVenta] = useState("");
  const ventaNum = parseFloat(venta);
  const ratio = ventaNum > 0 ? (costeTotal / ventaNum) * 100 : null;

  return (
    <div className="space-y-4">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="dia" tickLine={false} axisLine={false} fontSize={12} stroke="hsl(var(--muted-foreground))" />
            <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="hsl(var(--muted-foreground))" width={48} />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))" }}
              formatter={(v: number) => [euros(v), "Coste"]}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                fontSize: 12,
              }}
            />
            <Bar dataKey="coste" radius={[4, 4, 0, 0]}>
              {datos.map((_, i) => (
                <Cell key={i} fill="hsl(var(--primary))" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-muted/30 p-4">
        <div className="space-y-1.5">
          <Label>Ventas estimadas de la semana (opcional)</Label>
          <Input
            type="number"
            placeholder="Ej.: 18000"
            value={venta}
            onChange={(e) => setVenta(e.target.value)}
            className="w-44"
          />
        </div>
        {ratio !== null && (
          <div>
            <p className="text-sm text-muted-foreground">Ratio coste de personal / ventas</p>
            <p className="text-2xl font-semibold tabular-nums">{ratio.toFixed(1)} %</p>
          </div>
        )}
      </div>
    </div>
  );
}
