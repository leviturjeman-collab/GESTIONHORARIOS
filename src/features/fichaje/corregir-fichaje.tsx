"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { corregirFichaje, crearFichajeManual } from "@/features/fichaje/actions";

export function CorregirFichaje({
  fichajeId,
  empleadoId,
  entradaFecha,
  entradaHora,
  salidaFecha,
  salidaHora,
}: {
  fichajeId?: string;
  empleadoId?: string;
  entradaFecha: string;
  entradaHora: string;
  salidaFecha: string;
  salidaHora: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    entradaFecha,
    entradaHora,
    salidaFecha,
    salidaHora,
    motivo: "",
  });

  const esCreacion = !fichajeId;

  async function guardar() {
    setBusy(true);
    let res;
    if (esCreacion) {
      if (!empleadoId) {
        toast.error("Falta el ID del empleado");
        setBusy(false);
        return;
      }
      res = await crearFichajeManual(empleadoId, form);
    } else {
      res = await corregirFichaje(fichajeId, form);
    }
    setBusy(false);
    if (res.ok) {
      toast.success(esCreacion ? "Fichaje manual creado correctamente" : "Fichaje corregido (se conserva el original)");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          {esCreacion ? <Plus className="size-4 mr-1" /> : <Pencil className="size-4 mr-1" />}
          {esCreacion ? "Fichar manual" : "Corregir"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{esCreacion ? "Crear fichaje manual" : "Corregir fichaje"}</DialogTitle>
          <DialogDescription>
            {esCreacion
              ? "Registra una entrada y salida de forma manual para este empleado. Se requiere justificación."
              : "El dato original se conserva para la auditoría. La corrección exige justificación."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha Entrada</Label>
              <Input type="date" value={form.entradaFecha} onChange={(e) => setForm({ ...form, entradaFecha: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Hora Entrada</Label>
              <Input value={form.entradaHora} onChange={(e) => setForm({ ...form, entradaHora: e.target.value })} placeholder="HH:mm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha Salida</Label>
              <Input type="date" value={form.salidaFecha} onChange={(e) => setForm({ ...form, salidaFecha: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Hora Salida</Label>
              <Input value={form.salidaHora} onChange={(e) => setForm({ ...form, salidaHora: e.target.value })} placeholder="HH:mm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Motivo {esCreacion ? "del registro" : "de la corrección"}</Label>
            <Textarea
              value={form.motivo}
              onChange={(e) => setForm({ ...form, motivo: e.target.value })}
              placeholder={esCreacion ? "Ej.: olvidó fichar al entrar y salir" : "Ej.: olvidó fichar la salida"}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} {esCreacion ? "Crear fichaje" : "Guardar corrección"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
