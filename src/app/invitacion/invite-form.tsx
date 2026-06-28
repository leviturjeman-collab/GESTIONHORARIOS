"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { aceptarInvitacion } from "@/app/invitacion/actions";

export function InviteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [busy, setBusy] = useState(false);
  const [hecho, setHecho] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await aceptarInvitacion({ token, password, confirmar });
    setBusy(false);
    if (res.ok) {
      setHecho(true);
      toast.success("Cuenta activada. Ya puedes iniciar sesión.");
      setTimeout(() => router.push("/login"), 1500);
    } else toast.error(res.error);
  }

  if (!token) {
    return <p className="text-sm text-danger">Falta el token de invitación en el enlace.</p>;
  }
  if (hecho) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <CheckCircle2 className="size-8 text-success" />
        <p className="font-medium">¡Cuenta activada!</p>
        <p className="text-sm text-muted-foreground">Redirigiéndote al inicio de sesión…</p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div className="space-y-2">
        <Label>Nueva contraseña</Label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>Repite la contraseña</Label>
        <Input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="animate-spin" />} Activar mi cuenta
      </Button>
    </form>
  );
}
