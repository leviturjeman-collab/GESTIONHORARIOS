"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { resolverAusencia } from "@/features/vacaciones/actions";

export function ResolveButtons({ id }: { id: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState<null | "aprobar" | "rechazar">(null);
  const [comentario, setComentario] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirmar() {
    if (!abierto) return;
    setBusy(true);
    const res = await resolverAusencia(id, abierto === "aprobar", comentario);
    setBusy(false);
    if (res.ok) {
      toast.success(abierto === "aprobar" ? "Solicitud aprobada" : "Solicitud rechazada");
      setAbierto(null);
      setComentario("");
      router.refresh();
    } else toast.error(res.error);
  }

  return (
    <>
      <div className="flex gap-1.5">
        <Button size="sm" variant="success" onClick={() => setAbierto("aprobar")}>
          <Check /> Aprobar
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAbierto("rechazar")}>
          <X /> Rechazar
        </Button>
      </div>

      <Dialog open={!!abierto} onOpenChange={(o) => !o && setAbierto(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {abierto === "aprobar" ? "Aprobar solicitud" : "Rechazar solicitud"}
            </DialogTitle>
            <DialogDescription>
              Puedes añadir un comentario para el empleado (opcional).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Comentario…"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbierto(null)}>
              Cancelar
            </Button>
            <Button
              variant={abierto === "aprobar" ? "success" : "danger"}
              onClick={confirmar}
              disabled={busy}
            >
              {busy && <Loader2 className="animate-spin" />}
              {abierto === "aprobar" ? "Aprobar" : "Rechazar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
