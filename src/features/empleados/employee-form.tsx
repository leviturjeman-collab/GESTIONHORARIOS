"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, KeyRound, RefreshCw, CheckCircle2, Mail } from "lucide-react";
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ROLES_FUNCIONALES, etiquetaRol, TIPOS_CONTRATO, etiquetaContrato } from "@/lib/enums";
import { crearEmpleado, actualizarEmpleado, regenerarPin, enviarPinPorEmail, getResumenHoras } from "@/features/empleados/actions";
import { cn } from "@/lib/utils";

function ControlHorarioPanel({ empleadoId }: { empleadoId: string }) {
  const [mes, setMes] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [datos, setDatos] = useState<{ horasContratoMes: number; horasTrabajadas: number; horasExtra: number } | null>(null);
  const [cargando, setCargando] = useState(false);

  async function cargar() {
    setCargando(true);
    const res = await getResumenHoras(empleadoId, mes);
    setCargando(false);
    if (res.ok && res.data) setDatos(res.data);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [mes, empleadoId]);

  return (
    <div className="space-y-4 p-5 pt-2">
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <Label>Mes</Label>
          <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
        </div>
        <Button variant="outline" size="icon" onClick={cargar} disabled={cargando}>
          <RefreshCw className={cn("size-4", cargando && "animate-spin")} />
        </Button>
      </div>
      
      {datos ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
            <div className="flex justify-between items-center pb-3 border-b border-border">
              <span className="text-sm font-medium text-muted-foreground">Horas según contrato</span>
              <span className="font-mono text-base font-semibold">{datos.horasContratoMes}h</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-border">
              <span className="text-sm font-medium text-muted-foreground">Horas programadas (Total)</span>
              <span className="font-mono text-base font-semibold">{datos.horasTrabajadas}h</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-sm font-bold">Horas extra estimadas</span>
              <span className={cn("font-mono text-lg font-bold", datos.horasExtra > 0 ? "text-danger" : "text-success")}>
                {datos.horasExtra > 0 ? "+" : ""}{datos.horasExtra}h
              </span>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground text-center">
            Calculado en base a los turnos asignados en el calendario de este mes vs la jornada teórica semanal ({datos.horasContratoMes}h/mes = horas de contrato × 4.33 semanas).
          </p>
        </div>
      ) : (
        <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
          {cargando ? "Calculando horas..." : "No hay datos"}
        </div>
      )}
    </div>
  );
}

type Ubic = { id: string; nombre: string };
type EmpleadoEdit = {
  id: string;
  nombre: string;
  apellidos: string | null;
  email: string | null;
  telefono: string | null;
  rolFuncional: string;
  ubicacionId: string | null;
  saldoVacaciones: number;
  pinFichaje: string | null;
  contrato: {
    tipo: string;
    horasSemana: number;
    costeHora: number;
    admiteHorasExtra: boolean;
  } | null;
};

export function EmployeeForm({
  ubicaciones,
  empleado,
  children,
}: {
  ubicaciones: Ubic[];
  empleado?: EmpleadoEdit;
  children: React.ReactNode; // trigger
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [regenerando, setRegenerando] = useState(false);
  // Estado del PIN
  const [pinCreado, setPinCreado] = useState<string | null>(null);
  const [conLogin, setConLogin] = useState(true);
  const [pinActual, setPinActual] = useState(empleado?.pinFichaje ?? null);
  const [enviando, setEnviando] = useState(false);

  async function enviarPin() {
    if (!empleado) return;
    setEnviando(true);
    const res = await enviarPinPorEmail(empleado.id);
    setEnviando(false);
    if (res.ok) {
      toast.success("PIN enviado por correo electrónico");
    } else {
      toast.error(res.error);
    }
  }

  const [form, setForm] = useState({
    nombre: empleado?.nombre ?? "",
    apellidos: empleado?.apellidos ?? "",
    email: empleado?.email ?? "",
    telefono: empleado?.telefono ?? "",
    rolFuncional: empleado?.rolFuncional ?? "camarero",
    ubicacionId: empleado?.ubicacionId ?? ubicaciones[0]?.id ?? "",
    tipo: empleado?.contrato?.tipo ?? "INDEFINIDO_COMPLETO",
    admiteHorasExtra: empleado?.contrato?.admiteHorasExtra ?? true,
    horasSemana: String(empleado?.contrato?.horasSemana ?? 40),
    costeHora: String(empleado?.contrato?.costeHora ?? 12),
    saldoVacaciones: String(empleado?.saldoVacaciones ?? 30),
    pinFichaje: empleado?.pinFichaje ?? "",
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function guardar() {
    setCargando(true);
    if (empleado) {
      const res = await actualizarEmpleado(empleado.id, form);
      setCargando(false);
      if (res.ok) {
        toast.success("Empleado actualizado");
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
      return;
    }
    const res = await crearEmpleado(form);
    setCargando(false);
    if (res.ok && res.data) {
      setPinCreado(res.data.pin);
      setConLogin(res.data.conLogin);
      router.refresh();
    } else if (!res.ok) {
      toast.error(res.error);
    }
  }

  async function regenerar() {
    if (!empleado) return;
    setRegenerando(true);
    const res = await regenerarPin(empleado.id);
    setRegenerando(false);
    if (res.ok && res.data) {
      set("pinFichaje", res.data.pin);
      toast.success("PIN regenerado (no olvides guardar los cambios)");
      router.refresh();
    } else if (!res.ok) toast.error(res.error);
  }

  function cerrar(o: boolean) {
    setOpen(o);
    if (!o) setPinCreado(null);
  }

  return (
    <Sheet open={open} onOpenChange={cerrar}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{empleado ? "Editar empleado" : "Nuevo empleado"}</SheetTitle>
          <SheetDescription>
            Datos personales y de contrato. El coste/hora se usa para los costes
            laborales.
          </SheetDescription>
        </SheetHeader>

        {/* Panel de confirmación con el PIN tras crear */}
        {pinCreado ? (
          <div className="space-y-5 p-5 text-center">
            <CheckCircle2 className="mx-auto size-12 text-success" />
            <div>
              <p className="text-base font-semibold">Empleado creado</p>
              <p className="text-sm text-muted-foreground">
                {conLogin
                  ? "Ya puede iniciar sesión con su correo y este PIN."
                  : "Sin correo no se crea acceso; el PIN sirve para el modo tablet."}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-6">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                PIN de acceso
              </p>
              <p className="mt-1 font-mono text-4xl font-bold tracking-[0.3em] text-primary">
                {pinCreado}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Anótalo y compártelo con el empleado. Podrás verlo y regenerarlo al editar su ficha.
            </p>
            <Button className="w-full" onClick={() => cerrar(false)}>
              Hecho
            </Button>
          </div>
        ) : (
          empleado ? (
            <Tabs defaultValue="datos" className="mt-4">
              <TabsList className="grid w-full grid-cols-2 mx-5 mb-2 max-w-[calc(100%-40px)]">
                <TabsTrigger value="datos">Datos y Contrato</TabsTrigger>
                <TabsTrigger value="horas">Control Horario</TabsTrigger>
              </TabsList>
              <TabsContent value="datos">
                <div className="space-y-4 p-5 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Nombre</Label>
                      <Input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Apellidos</Label>
                      <Input value={form.apellidos} onChange={(e) => set("apellidos", e.target.value)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Correo</Label>
                      <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Teléfono</Label>
                      <Input value={form.telefono} onChange={(e) => set("telefono", e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>PIN de acceso (4 dígitos)</Label>
                    <div className="flex gap-2">
                      <Input
                        value={form.pinFichaje}
                        onChange={(e) => set("pinFichaje", e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="Ej: 1234 (Vacío = aleatorio)"
                        maxLength={4}
                        className="font-mono tracking-widest"
                      />
                      {empleado && (
                        <>
                          <Button variant="outline" size="icon" onClick={regenerar} disabled={regenerando || enviando} type="button" title="Generar PIN aleatorio">
                            {regenerando ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                          </Button>
                          <Button variant="outline" size="icon" onClick={enviarPin} disabled={enviando || regenerando || !form.email || !form.pinFichaje} type="button" title="Enviar PIN por correo">
                            {enviando ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                          </Button>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      El empleado inicia sesión con su correo y este PIN. {empleado ? "Si lo cambias, se actualizará al guardar." : "Dejar en blanco para generarlo automáticamente."}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Rol funcional</Label>
                      <Select value={form.rolFuncional} onValueChange={(v) => set("rolFuncional", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLES_FUNCIONALES.map((r) => (
                            <SelectItem key={r} value={r}>{etiquetaRol(r)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Ubicación</Label>
                      <Select value={form.ubicacionId} onValueChange={(v) => set("ubicacionId", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ubicaciones.map((u) => (
                            <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Tipo de contrato</Label>
                    <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPOS_CONTRATO.map((t) => (
                          <SelectItem key={t} value={t}>{etiquetaContrato(t)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Horas/sem.</Label>
                      <Input type="number" value={form.horasSemana} onChange={(e) => set("horasSemana", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Coste/hora</Label>
                      <Input type="number" step="0.5" value={form.costeHora} onChange={(e) => set("costeHora", e.target.value)} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border p-3">
                    <Label>Admite horas extra</Label>
                    <Switch checked={form.admiteHorasExtra} onCheckedChange={(v) => set("admiteHorasExtra", v)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Saldo de vacaciones (días/año)</Label>
                    <Input type="number" value={form.saldoVacaciones} onChange={(e) => set("saldoVacaciones", e.target.value)} />
                  </div>
                  
                  <div className="border-t border-border mt-4 pt-4 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Revisa antes de guardar</p>
                    <Button onClick={guardar} disabled={cargando}>
                      {cargando && <Loader2 className="mr-2 size-4 animate-spin" />}
                      Guardar cambios
                    </Button>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="horas">
                <ControlHorarioPanel empleadoId={empleado.id} />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="space-y-4 p-5 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nombre</Label>
                  <Input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Apellidos</Label>
                  <Input value={form.apellidos} onChange={(e) => set("apellidos", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Correo</Label>
                  <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Teléfono</Label>
                  <Input value={form.telefono} onChange={(e) => set("telefono", e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>PIN de acceso (4 dígitos)</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.pinFichaje}
                    onChange={(e) => set("pinFichaje", e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="Ej: 1234 (Vacío = aleatorio)"
                    maxLength={4}
                    className="font-mono tracking-widest"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  El empleado inicia sesión con su correo y este PIN. Dejar en blanco para generarlo automáticamente.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Rol funcional</Label>
                  <Select value={form.rolFuncional} onValueChange={(v) => set("rolFuncional", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES_FUNCIONALES.map((r) => (
                        <SelectItem key={r} value={r}>{etiquetaRol(r)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Ubicación</Label>
                  <Select value={form.ubicacionId} onValueChange={(v) => set("ubicacionId", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ubicaciones.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Tipo de contrato</Label>
                <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_CONTRATO.map((t) => (
                      <SelectItem key={t} value={t}>{etiquetaContrato(t)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Horas/sem.</Label>
                  <Input type="number" value={form.horasSemana} onChange={(e) => set("horasSemana", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Coste/hora</Label>
                  <Input type="number" step="0.5" value={form.costeHora} onChange={(e) => set("costeHora", e.target.value)} />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <Label>Admite horas extra</Label>
                <Switch checked={form.admiteHorasExtra} onCheckedChange={(v) => set("admiteHorasExtra", v)} />
              </div>

              <div className="space-y-1.5">
                <Label>Saldo de vacaciones (días/año)</Label>
                <Input type="number" value={form.saldoVacaciones} onChange={(e) => set("saldoVacaciones", e.target.value)} />
              </div>

              <div className="border-t border-border mt-4 pt-4 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Revisa antes de crear</p>
                <Button onClick={guardar} disabled={cargando}>
                  {cargando && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Crear empleado
                </Button>
              </div>
            </div>
          )
        )}
      </SheetContent>
    </Sheet>
  );
}
