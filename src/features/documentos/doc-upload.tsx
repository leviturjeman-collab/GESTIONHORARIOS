"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, Loader2, Paperclip } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { subirDocumento } from "@/features/documentos/actions";

export function DocUpload({ empleadoId }: { empleadoId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tipo, setTipo] = useState("CONTRATO");
  const fileRef = useRef<HTMLInputElement>(null);

  async function subir() {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("Selecciona un archivo");
    setBusy(true);
    const fd = new FormData();
    fd.append("empleadoId", empleadoId);
    fd.append("tipo", tipo);
    fd.append("archivo", file);
    const res = await subirDocumento(fd);
    setBusy(false);
    if (res.ok) {
      toast.success("Documento subido");
      setOpen(false);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } else toast.error(res.error);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Paperclip /> Subir
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subir documento</DialogTitle>
          <DialogDescription>Contrato, nómina o justificante (PDF, máx. 10 MB).</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CONTRATO">Contrato</SelectItem>
                <SelectItem value="NOMINA">Nómina</SelectItem>
                <SelectItem value="JUSTIFICANTE">Justificante (restringido)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Archivo</Label>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="block w-full text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={subir} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Upload />} Subir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
