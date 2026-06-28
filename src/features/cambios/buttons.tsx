"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { proponerCambio, responderCambio, aprobarCambio } from "@/features/cambios/actions";

export function RespondButtons({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function responder(aceptar: boolean) {
    setBusy(true);
    const res = await responderCambio(id, aceptar);
    setBusy(false);
    res.ok ? toast.success(aceptar ? "Aceptado" : "Rechazado") : toast.error(res.error);
    router.refresh();
  }
  return (
    <div className="flex gap-1.5">
      <Button size="sm" variant="success" disabled={busy} onClick={() => responder(true)}>
        <Check /> Aceptar
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => responder(false)}>
        <X /> Rechazar
      </Button>
    </div>
  );
}

export function ApproveButtons({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function aprobar(ok: boolean) {
    setBusy(true);
    const res = await aprobarCambio(id, ok);
    setBusy(false);
    res.ok ? toast.success(ok ? "Confirmado" : "Rechazado") : toast.error(res.error);
    router.refresh();
  }
  return (
    <div className="flex gap-1.5">
      <Button size="sm" variant="success" disabled={busy} onClick={() => aprobar(true)}>
        <Check /> Aprobar
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => aprobar(false)}>
        <X /> Rechazar
      </Button>
    </div>
  );
}

type TurnoOpt = { id: string; label: string };
type Compa = { id: string; nombre: string };

export function ProposeForm({ turnos, companeros }: { turnos: TurnoOpt[]; companeros: Compa[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [turnoId, setTurnoId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function enviar() {
    if (!turnoId || !destinoId) return toast.error("Elige turno y compañero");
    setBusy(true);
    const res = await proponerCambio(turnoId, destinoId, mensaje);
    setBusy(false);
    if (res.ok) {
      toast.success("Propuesta enviada");
      setOpen(false);
      setTurnoId("");
      setDestinoId("");
      setMensaje("");
      router.refresh();
    } else toast.error(res.error);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={turnos.length === 0}>
          <Plus /> Proponer cambio
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Proponer un cambio de turno</DialogTitle>
          <DialogDescription>Ofrece uno de tus turnos a un compañero.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tu turno</Label>
            <Select value={turnoId} onValueChange={setTurnoId}>
              <SelectTrigger><SelectValue placeholder="Elige un turno" /></SelectTrigger>
              <SelectContent>
                {turnos.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Compañero</Label>
            <Select value={destinoId} onValueChange={setDestinoId}>
              <SelectTrigger><SelectValue placeholder="Elige un compañero" /></SelectTrigger>
              <SelectContent>
                {companeros.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Mensaje (opcional)</Label>
            <Textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={enviar} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
