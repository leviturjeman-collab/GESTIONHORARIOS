"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import { ROLES_FUNCIONALES, etiquetaRol } from "@/lib/enums";
import { DIAS_SEMANA } from "@/lib/utils";
import { añadirCobertura, eliminarCobertura } from "@/features/cobertura/actions";

type Cob = {
  id: string;
  rol: string;
  diaSemana: number | null;
  franjaInicio: string;
  franjaFin: string;
  minPersonas: number;
};

export function CoberturaEditor({
  ubicacionId,
  coberturas,
  children,
}: {
  ubicacionId: string;
  coberturas: Cob[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    rol: "camarero",
    diaSemana: "-1",
    franjaInicio: "13:00",
    franjaFin: "16:00",
    minPersonas: "2",
  });

  async function añadir() {
    setBusy(true);
    const res = await añadirCobertura(ubicacionId, form);
    setBusy(false);
    if (res.ok) {
      toast.success("Regla de cobertura añadida");
      router.refresh();
    } else toast.error(res.error);
  }
  async function borrar(id: string) {
    const res = await eliminarCobertura(id);
    res.ok ? toast.success("Regla eliminada") : toast.error(res.error);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Cobertura mínima</SheetTitle>
          <SheetDescription>
            Personas necesarias por rol y franja. La usan el semáforo de cobertura, el
            detector y la generación automática.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-5">
          {/* Lista actual */}
          {coberturas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay reglas de cobertura.</p>
          ) : (
            <ul className="space-y-2">
              {coberturas.map((c) => (
                <li key={c.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
                  <span className="flex-1">
                    <span className="font-medium">{c.minPersonas}×</span> {etiquetaRol(c.rol)} ·{" "}
                    {c.franjaInicio}–{c.franjaFin} ·{" "}
                    {c.diaSemana == null ? "todos los días" : DIAS_SEMANA[c.diaSemana]}
                  </span>
                  <button onClick={() => borrar(c.id)} className="text-muted-foreground hover:text-danger">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Alta */}
          <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
            <p className="text-sm font-medium">Nueva regla</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Rol</Label>
                <Select value={form.rol} onValueChange={(v) => setForm({ ...form, rol: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES_FUNCIONALES.map((r) => (
                      <SelectItem key={r} value={r}>{etiquetaRol(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Día</Label>
                <Select value={form.diaSemana} onValueChange={(v) => setForm({ ...form, diaSemana: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-1">Todos</SelectItem>
                    {DIAS_SEMANA.map((d, i) => (
                      <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Desde</Label>
                <Input className="h-8" value={form.franjaInicio} onChange={(e) => setForm({ ...form, franjaInicio: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hasta</Label>
                <Input className="h-8" value={form.franjaFin} onChange={(e) => setForm({ ...form, franjaFin: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mín. personas</Label>
                <Input className="h-8" type="number" value={form.minPersonas} onChange={(e) => setForm({ ...form, minPersonas: e.target.value })} />
              </div>
            </div>
            <Button size="sm" onClick={añadir} disabled={busy} className="w-full">
              {busy ? <Loader2 className="animate-spin" /> : <Plus />} Añadir regla
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
