"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { crearUbicacion, actualizarUbicacion, eliminarUbicacion } from "@/features/ubicaciones/actions";

type Manager = { id: string; nombre: string };

export function LocationForm({
  managers,
  ubicacion,
  children,
}: {
  managers: Manager[];
  ubicacion?: any;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [borrando, setBorrando] = useState(false);

  async function borrar() {
    if (!window.confirm("¿Seguro que quieres eliminar esta ubicación? Esta acción no se puede deshacer y borrará todos sus cuadrantes, reglas y plantillas asociadas.")) return;
    setBorrando(true);
    const res = await eliminarUbicacion(ubicacion.id);
    setBorrando(false);
    if (res.ok) {
      toast.success("Ubicación eliminada correctamente");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  // Parseo inicial de ajustes
  const ubicAjustes = ubicacion?.ajustes ? JSON.parse(ubicacion.ajustes) : {};
  const currentHorarioCustom = ubicAjustes.horarioCustom || {
    aperturaSemana: ubicacion?.horaApertura ?? "09:00",
    cierreSemana: ubicacion?.horaCierre ?? "23:00",
    diferenteFinSemana: false,
    aperturaFinSemana: ubicacion?.horaApertura ?? "09:00",
    cierreFinSemana: ubicacion?.horaCierre ?? "23:00",
    diasCierre: [] as number[],
  };

  const [form, setForm] = useState({
    nombre: ubicacion?.nombre ?? "",
    direccion: ubicacion?.direccion ?? "",
    horaApertura: currentHorarioCustom.aperturaSemana || ubicacion?.horaApertura || "09:00",
    horaCierre: currentHorarioCustom.cierreSemana || ubicacion?.horaCierre || "23:00",
    requiereAprobacionCambios: ubicacion?.requiereAprobacionCambios ?? true,
    managerId: ubicacion?.managers?.[0]?.id ?? "",
    diferenteFinSemana: currentHorarioCustom.diferenteFinSemana ?? false,
    aperturaFinSemana: currentHorarioCustom.aperturaFinSemana || "09:00",
    cierreFinSemana: currentHorarioCustom.cierreFinSemana || "23:00",
    diasCierre: (currentHorarioCustom.diasCierre || []) as number[],
  });

  function set<K extends keyof typeof form>(k: K, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function guardar() {
    setCargando(true);
    const payload = {
      nombre: form.nombre,
      direccion: form.direccion,
      horaApertura: form.horaApertura,
      horaCierre: form.horaCierre,
      requiereAprobacionCambios: form.requiereAprobacionCambios,
      managerId: form.managerId,
      horarioCustom: {
        aperturaSemana: form.horaApertura,
        cierreSemana: form.horaCierre,
        diferenteFinSemana: form.diferenteFinSemana,
        aperturaFinSemana: form.diferenteFinSemana ? form.aperturaFinSemana : form.horaApertura,
        cierreFinSemana: form.diferenteFinSemana ? form.cierreFinSemana : form.horaCierre,
        diasCierre: form.diasCierre,
      },
    };
    const res = ubicacion
      ? await actualizarUbicacion(ubicacion.id, payload)
      : await crearUbicacion(payload);
    setCargando(false);
    if (res.ok) {
      toast.success(ubicacion ? "Ubicación actualizada" : "Ubicación creada");
      setOpen(false);
      router.refresh();
    } else toast.error(res.error);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="overflow-y-auto w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{ubicacion ? "Editar ubicación" : "Nueva ubicación"}</SheetTitle>
          <SheetDescription>
            Datos del local, horario de apertura y reglas de funcionamiento.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Dirección</Label>
            <Input value={form.direccion} onChange={(e) => set("direccion", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{form.diferenteFinSemana ? "Apertura (Lunes a Viernes)" : "Hora de apertura (todos los días)"}</Label>
              <Input type="time" value={form.horaApertura} onChange={(e) => set("horaApertura", e.target.value)} placeholder="09:00" />
            </div>
            <div className="space-y-1.5">
              <Label>{form.diferenteFinSemana ? "Cierre (Lunes a Viernes)" : "Hora de cierre (todos los días)"}</Label>
              <Input type="time" value={form.horaCierre} onChange={(e) => set("horaCierre", e.target.value)} placeholder="23:00" />
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-md border border-border/60 p-3 bg-muted/20">
            <Switch
              id="loc-dif-fin-semana"
              checked={form.diferenteFinSemana}
              onCheckedChange={(val) => set("diferenteFinSemana", val)}
            />
            <Label htmlFor="loc-dif-fin-semana" className="text-xs cursor-pointer font-semibold">
              ¿Tiene horario diferente el fin de semana (Sábado y Domingo)?
            </Label>
          </div>

          {form.diferenteFinSemana && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-dashed border-border bg-muted/10">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Apertura Fin de Semana</Label>
                <Input
                  type="time"
                  className="h-8"
                  value={form.aperturaFinSemana}
                  onChange={(ev) => set("aperturaFinSemana", ev.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Cierre Fin de Semana</Label>
                <Input
                  type="time"
                  className="h-8"
                  value={form.cierreFinSemana}
                  onChange={(ev) => set("cierreFinSemana", ev.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2 border-t border-border/40 pt-3">
            <Label className="text-xs font-semibold">¿Cierra algún día de la semana?</Label>
            <div className="flex flex-wrap gap-1.5">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((dayName, dayIdx) => {
                const isClosed = form.diasCierre.includes(dayIdx);
                return (
                  <button
                    key={dayName}
                    type="button"
                    onClick={() => {
                      const nextDias = isClosed
                        ? form.diasCierre.filter((d) => d !== dayIdx)
                        : [...form.diasCierre, dayIdx];
                      set("diasCierre", nextDias);
                    }}
                    className={cn(
                      "px-3 py-1 rounded text-xs font-medium border transition-all",
                      isClosed
                        ? "border-destructive bg-destructive/10 text-destructive shadow-sm"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {dayName} {isClosed && "(Cerrado)"}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Manager responsable</Label>
            <Select value={form.managerId || "ninguno"} onValueChange={(v) => set("managerId", v === "ninguno" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguno">Sin asignar</SelectItem>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">Los cambios de turno requieren aprobación</p>
              <p className="text-xs text-muted-foreground">
                Si está activo, el responsable debe validar cada intercambio.
              </p>
            </div>
            <Switch
              checked={form.requiereAprobacionCambios}
              onCheckedChange={(v) => set("requiereAprobacionCambios", v)}
            />
          </div>
          <div className="flex justify-between items-center pt-2">
            {ubicacion ? (
              <Button
                variant="ghost"
                type="button"
                className="text-destructive hover:bg-destructive/10"
                onClick={borrar}
                disabled={cargando || borrando}
              >
                {borrando ? <Loader2 className="size-4 animate-spin mr-1" /> : <Trash2 className="size-4 mr-1" />}
                Eliminar
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" type="button" onClick={() => setOpen(false)} disabled={cargando || borrando}>
                Cancelar
              </Button>
              <Button onClick={guardar} disabled={cargando || borrando}>
                {cargando && <Loader2 className="animate-spin mr-1" />}
                {ubicacion ? "Guardar" : "Crear ubicación"}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
