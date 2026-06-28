"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Delete, Loader2, LogIn, LogOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, iniciales } from "@/lib/utils";
import { ficharConPin } from "@/features/fichaje/tablet-actions";

type Emp = {
  id: string;
  nombre: string;
  apellidos: string | null;
  color: string | null;
  trabajando: boolean;
};

function obtenerPosicion(): Promise<{ lat?: number; lng?: number }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

export function TabletBoard({ empleados }: { empleados: Emp[] }) {
  const router = useRouter();
  const [sel, setSel] = useState<Emp | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  function abrir(e: Emp) {
    setSel(e);
    setPin("");
  }
  function pulsar(d: string) {
    setPin((p) => (p.length >= 4 ? p : p + d));
  }

  async function confirmar() {
    if (!sel || pin.length < 4) return;
    setBusy(true);
    const pos = await obtenerPosicion();
    const res = await ficharConPin(sel.id, pin, pos.lat, pos.lng);
    setBusy(false);
    if (res.ok && res.data) {
      toast.success(`${res.data.nombre}: ${res.data.accion === "entrada" ? "entrada" : "salida"} registrada`);
      setSel(null);
      setPin("");
      router.refresh();
    } else {
      toast.error(res.ok ? "Error" : res.error);
      setPin("");
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {empleados.map((e) => (
          <button
            key={e.id}
            onClick={() => abrir(e)}
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-5 text-center transition hover:border-primary hover:shadow-sm active:scale-[0.98]"
          >
            <Avatar nombre={iniciales(e.nombre, e.apellidos)} color={e.color ?? undefined} size={56} />
            <span className="text-sm font-medium leading-tight">
              {e.nombre} {e.apellidos}
            </span>
            <Badge variant={e.trabajando ? "success" : "neutral"}>
              {e.trabajando ? "Trabajando" : "Fuera"}
            </Badge>
          </button>
        ))}
      </div>

      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">
              {sel?.nombre} {sel?.apellidos}
            </DialogTitle>
            <DialogDescription className="text-center">
              {sel?.trabajando ? "Introduce tu PIN para fichar salida" : "Introduce tu PIN para fichar entrada"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center gap-3 py-2">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  "size-4 rounded-full border-2",
                  i < pin.length ? "border-primary bg-primary" : "border-border"
                )}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button
                key={n}
                onClick={() => pulsar(String(n))}
                className="rounded-lg border border-border py-3 text-lg font-semibold hover:bg-muted active:scale-95"
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPin((p) => p.slice(0, -1))}
              className="flex items-center justify-center rounded-lg border border-border py-3 hover:bg-muted"
            >
              <Delete className="size-5" />
            </button>
            <button
              onClick={() => pulsar("0")}
              className="rounded-lg border border-border py-3 text-lg font-semibold hover:bg-muted active:scale-95"
            >
              0
            </button>
            <button
              onClick={confirmar}
              disabled={pin.length < 4 || busy}
              className={cn(
                "flex items-center justify-center rounded-lg py-3 text-white disabled:opacity-40",
                sel?.trabajando ? "bg-danger" : "bg-success"
              )}
            >
              {busy ? <Loader2 className="size-5 animate-spin" /> : sel?.trabajando ? <LogOut className="size-5" /> : <LogIn className="size-5" />}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
