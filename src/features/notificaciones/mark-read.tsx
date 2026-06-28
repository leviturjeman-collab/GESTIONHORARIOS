"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { marcarTodasLeidas } from "@/features/notificaciones/actions";

export function MarkAllRead() {
  const router = useRouter();
  async function marcar() {
    const res = await marcarTodasLeidas();
    if (res.ok) {
      toast.success("Notificaciones marcadas como leídas");
      router.refresh();
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={marcar}>
      <CheckCheck /> Marcar todas como leídas
    </Button>
  );
}
