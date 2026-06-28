"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogIn, LogOut, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ficharEntrada, ficharSalida } from "@/features/fichaje/actions";

function obtenerPosicion(): Promise<{ lat?: number; lng?: number; error?: string }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ error: "Tu navegador o dispositivo no soporta geolocalización." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        let msg = "No hemos podido obtener tu ubicación.";
        if (err.code === 1) {
          msg = "Permiso de ubicación denegado. Por favor, activa el GPS y concede permisos de ubicación en tu navegador para poder fichar.";
        } else if (err.code === 2) {
          msg = "Ubicación no disponible. Asegúrate de tener buena cobertura o conexión a internet.";
        } else if (err.code === 3) {
          msg = "Tiempo de espera agotado al obtener la ubicación. Vuelve a intentarlo.";
        }
        resolve({ error: msg });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

export function ClockButton({
  abierto,
  empleadoId,
}: {
  abierto: boolean;
  empleadoId?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [estado, setEstado] = useState<string>("");

  async function fichar() {
    setBusy(true);
    setEstado("Obteniendo tu ubicación…");
    const pos = await obtenerPosicion();
    if (pos.error) {
      setBusy(false);
      setEstado("");
      toast.error(pos.error);
      return;
    }
    setEstado(abierto ? "Fichando salida…" : "Fichando entrada…");
    const res = abierto
      ? await ficharSalida({ lat: pos.lat, lng: pos.lng, empleadoId })
      : await ficharEntrada({ lat: pos.lat, lng: pos.lng, empleadoId });
    setBusy(false);
    setEstado("");
    if (res.ok) {
      toast.success(abierto ? "Salida fichada" : "Entrada fichada");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        size="lg"
        variant={abierto ? "danger" : "success"}
        className="h-16 w-full text-lg"
        onClick={fichar}
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="animate-spin" />
        ) : abierto ? (
          <LogOut className="size-5" />
        ) : (
          <LogIn className="size-5" />
        )}
        {busy ? estado : abierto ? "Fichar salida" : "Fichar entrada"}
      </Button>
      <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
        <MapPin className="size-3" /> El fichaje verifica que estás en el local (radio 100 m).
      </p>
    </div>
  );
}
