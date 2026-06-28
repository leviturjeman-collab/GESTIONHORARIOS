"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { DIAS_SEMANA, cn } from "@/lib/utils";
import { guardarDisponibilidad } from "@/features/disponibilidad/actions";

const ESTADOS = [
  { valor: "DISPONIBLE", label: "Disponible", clase: "bg-success-soft text-success border-success/30" },
  { valor: "PREFIERE_NO", label: "Prefiero no", clase: "bg-warning-soft text-warning-foreground border-warning/30" },
  { valor: "NO_DISPONIBLE", label: "No disponible", clase: "bg-danger-soft text-danger border-danger/30" },
];
const etiqueta = (v: string) => ESTADOS.find((e) => e.valor === v)?.label ?? v;

type DiaState = { estado: string; franjaInicio: string; franjaFin: string };
type Exc = { fecha: string; estado: string; franjaInicio: string; franjaFin: string };

export function AvailabilityGrid({
  inicialRecurrentes,
  inicialExcepciones,
}: {
  inicialRecurrentes: { diaSemana: number; estado: string; franjaInicio: string; franjaFin: string }[];
  inicialExcepciones: Exc[];
}) {
  const router = useRouter();
  const [dias, setDias] = useState<DiaState[]>(() =>
    Array.from({ length: 7 }, (_, i) => {
      const r = inicialRecurrentes.find((x) => x.diaSemana === i);
      return r
        ? { estado: r.estado, franjaInicio: r.franjaInicio, franjaFin: r.franjaFin }
        : { estado: "DISPONIBLE", franjaInicio: "00:00", franjaFin: "23:59" };
    })
  );
  const [excepciones, setExcepciones] = useState<Exc[]>(inicialExcepciones);
  const [nuevaExc, setNuevaExc] = useState({ fecha: "", estado: "NO_DISPONIBLE" });
  const [busy, setBusy] = useState(false);

  function ciclar(i: number) {
    setDias((arr) =>
      arr.map((d, idx) => {
        if (idx !== i) return d;
        const next = ESTADOS[(ESTADOS.findIndex((e) => e.valor === d.estado) + 1) % ESTADOS.length].valor;
        return { ...d, estado: next };
      })
    );
  }
  function setFranja(i: number, campo: "franjaInicio" | "franjaFin", v: string) {
    setDias((arr) => arr.map((d, idx) => (idx === i ? { ...d, [campo]: v } : d)));
  }

  function añadirExc() {
    if (!nuevaExc.fecha) return toast.error("Elige una fecha");
    setExcepciones((e) => [...e, { ...nuevaExc, franjaInicio: "00:00", franjaFin: "23:59" }]);
    setNuevaExc({ fecha: "", estado: "NO_DISPONIBLE" });
  }

  async function guardar() {
    setBusy(true);
    const res = await guardarDisponibilidad({
      recurrentes: dias.map((d, i) => ({ diaSemana: i, ...d })),
      excepciones,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Disponibilidad guardada");
      router.refresh();
    } else toast.error(res.error);
  }

  return (
    <div className="space-y-6">
      {/* Recurrente por día con franja */}
      <div className="space-y-2">
        {DIAS_SEMANA.map((nombre, i) => {
          const d = dias[i];
          const e = ESTADOS.find((x) => x.valor === d.estado)!;
          const todoElDia = d.franjaInicio === "00:00" && d.franjaFin === "23:59";
          return (
            <div key={i} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
              <span className="w-24 text-sm font-medium">{nombre}</span>
              <button
                onClick={() => ciclar(i)}
                className={cn("rounded-full border px-3 py-1 text-xs font-medium", e.clase)}
              >
                {e.label}
              </button>
              {d.estado !== "DISPONIBLE" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>de</span>
                  <Input
                    className="h-8 w-24"
                    value={d.franjaInicio}
                    onChange={(ev) => setFranja(i, "franjaInicio", ev.target.value)}
                  />
                  <span>a</span>
                  <Input
                    className="h-8 w-24"
                    value={d.franjaFin}
                    onChange={(ev) => setFranja(i, "franjaFin", ev.target.value)}
                  />
                  <span className="text-xs">{todoElDia ? "(todo el día)" : ""}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Excepciones por fecha */}
      <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
        <p className="text-sm font-medium">Excepciones por fecha</p>
        {excepciones.length > 0 && (
          <ul className="space-y-1.5">
            {excepciones.map((x, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="font-medium">{x.fecha}</span>
                <span className="text-muted-foreground">· {etiqueta(x.estado)}</span>
                <button
                  onClick={() => setExcepciones((e) => e.filter((_, idx) => idx !== i))}
                  className="text-muted-foreground hover:text-danger"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Fecha</Label>
            <Input
              type="date"
              className="h-8 w-44"
              value={nuevaExc.fecha}
              onChange={(e) => setNuevaExc({ ...nuevaExc, fecha: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Estado</Label>
            <Select value={nuevaExc.estado} onValueChange={(v) => setNuevaExc({ ...nuevaExc, estado: v })}>
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ESTADOS.map((e) => (
                  <SelectItem key={e.valor} value={e.valor}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" onClick={añadirExc}>
            <Plus /> Añadir
          </Button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={guardar} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Save />} Guardar disponibilidad
        </Button>
      </div>
    </div>
  );
}
