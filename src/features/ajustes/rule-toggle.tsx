"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { toggleAprobacion } from "@/features/ajustes/actions";

export function RuleToggle({ ubicacionId, inicial }: { ubicacionId: string; inicial: boolean }) {
  const router = useRouter();
  const [valor, setValor] = useState(inicial);

  async function cambiar(v: boolean) {
    setValor(v);
    const res = await toggleAprobacion(ubicacionId, v);
    if (res.ok) {
      toast.success("Regla actualizada");
      router.refresh();
    } else {
      setValor(!v);
      toast.error(res.error);
    }
  }

  return <Switch checked={valor} onCheckedChange={cambiar} />;
}
