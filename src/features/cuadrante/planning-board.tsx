"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Sparkles,
  AlertTriangle,
  Send,
  Save,
  LayoutTemplate,
  Trash2,
  Loader2,
  CheckCircle2,
  X,
  Plane,
  Undo2,
} from "lucide-react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { DIAS_SEMANA_CORTO, cn, horasTurno, horas, iniciales, minutosDeHora } from "@/lib/utils";
import { ROLES_FUNCIONALES, etiquetaRol, colorDeRol } from "@/lib/enums";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CalibracionIA } from "@/features/cuadrante/calibracion-ia";
import {
  crearTurno,
  actualizarTurno,
  eliminarTurno,
  moverTurno,
  publicarCuadrante,
  generarPreviewIA,
  aplicarPreviewIA,
  deshacerGeneracion,
  validarPropuesta,
  detectarProblemasAction,
  guardarPlantilla,
  aplicarPlantilla,
  eliminarPlantilla,
} from "@/features/cuadrante/actions";

type Emp = {
  id: string;
  nombre: string;
  apellidos: string | null;
  rol: string;
  color: string | null;
  horasContrato: number;
  tipoContrato: string;
  preferenciaTurno: string;
  permitePartido: boolean;
  admiteHorasExtra: boolean;
};
type Turno = {
  id: string;
  empleadoId: string;
  diaIdx: number;
  horaInicio: string;
  horaFin: string;
  partido: boolean;
  horaInicio2: string | null;
  horaFin2: string | null;
  rol: string;
  descansoMin: number;
  notas: string | null;
};
type Cob = { diaIdx: number; ok: boolean; faltas: { rol: string; franja: string; faltan: number }[] };

export function PlanningBoard({
  ubicacionId,
  semanaISO,
  estado,
  empleados,
  turnos,
  cobertura,
  plantillas,
  diasISO,
  recomendaciones,
  bloqueos,
  puedeDeshacer,
  ubicacionAjustes,
  ubicHoraApertura,
  ubicHoraCierre,
  disponibilidades,
}: {
  ubicacionId: string;
  semanaISO: string;
  estado: string;
  empleados: (Emp & { diasDescanso: number })[];
  turnos: Turno[];
  cobertura: Cob[];
  plantillas: { id: string; nombre: string }[];
  diasISO: string[];
  recomendaciones: { empleadoId: string; nombre: string; tipo: string; diasIdx: number[] }[];
  bloqueos: { empleadoId: string; diaIdx: number }[];
  puedeDeshacer: boolean;
  ubicacionAjustes: string;
  ubicHoraApertura: string;
  ubicHoraCierre: string;
  disponibilidades: any[];
}) {
  const router = useRouter();
  const bloqueado = estado === "BLOQUEADO";
  const celdaBloqueada = new Set(bloqueos.map((b) => `${b.empleadoId}-${b.diaIdx}`));
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function onDragEnd(ev: DragEndEvent) {
    const turnoId = String(ev.active.id);
    if (!ev.over) return;
    const [empleadoId, diaStr] = String(ev.over.id).split("|");
    const diaIdx = Number(diaStr);
    const turno = turnos.find((t) => t.id === turnoId);
    if (!turno) return;
    if (turno.empleadoId === empleadoId && turno.diaIdx === diaIdx) return; // sin cambio
    if (celdaBloqueada.has(`${empleadoId}-${diaIdx}`)) {
      toast.error("Ese día el empleado tiene una ausencia aprobada.");
      return;
    }
    const res = await moverTurno(turnoId, empleadoId, diasISO[diaIdx]);
    if (res.ok) {
      toast.success("Turno movido");
      router.refresh();
    } else toast.error(res.error);
  }

  // Edición de turno
  const [form, setForm] = useState<null | {
    turnoId?: string;
    empleadoId: string;
    diaIdx: number;
    horaInicio: string;
    horaFin: string;
    rol: string;
    partido: boolean;
    horaInicio2: string;
    horaFin2: string;
    descansoMin: string;
    notas: string;
  }>(null);
  const [guardando, setGuardando] = useState(false);

  const [confirmAiOpen, setConfirmAiOpen] = useState(false);

  // Plantillas
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [cargandoPlantilla, setCargandoPlantilla] = useState<string | null>(null);

  // Detector
  const [problemas, setProblemas] = useState<any[] | null>(null);
  const [detectando, setDetectando] = useState(false);

  const turnosDe = (empId: string, dia: number) =>
    turnos.filter((t) => t.empleadoId === empId && t.diaIdx === dia);
  const horasDe = (empId: string) =>
    turnos.filter((t) => t.empleadoId === empId).reduce((a, t) => a + horasTurno(t), 0);

  function nuevoTurno(empId: string, dia: number) {
    if (bloqueado || celdaBloqueada.has(`${empId}-${dia}`)) return;
    const emp = empleados.find((e) => e.id === empId);

    let horaInicio = "13:00";
    let horaFin = "17:00";
    let partido = true;

    // Check if employee or role permits split shifts
    const rolesPartido = JSON.parse(ubicacionAjustes || "{}").rolesTurnoPartido || [];
    const rolPermite = emp ? rolesPartido.includes(emp.rol) : false;
    const empPermite = emp ? emp.permitePartido !== false : true;
    const permitePartido = rolPermite && empPermite;

    if (emp?.preferenciaTurno === "MAÑANA") {
      horaInicio = "08:00";
      horaFin = "16:00";
      partido = false;
    } else if (emp?.preferenciaTurno === "TARDE") {
      horaInicio = "15:00";
      horaFin = "23:00";
      partido = false;
    } else if (emp?.preferenciaTurno === "NOCHE") {
      horaInicio = "23:00";
      horaFin = "07:00";
      partido = false;
    } else {
      // Indiferente
      if (!permitePartido) {
        horaInicio = "09:00";
        horaFin = "17:00";
        partido = false;
      }
    }

    setForm({
      empleadoId: empId,
      diaIdx: dia,
      horaInicio,
      horaFin,
      rol: emp?.rol ?? "camarero",
      partido,
      horaInicio2: "20:00",
      horaFin2: "23:00",
      descansoMin: "0",
      notas: "",
    });
  }

  const getEmpleadoProblemas = (empId: string) => {
    const issues: string[] = [];
    const emp = empleados.find((x) => x.id === empId);
    if (!emp) return issues;

    const empTurnos = turnos.filter((t) => t.empleadoId === empId);

    // 1. Exceso de horas
    const h = empTurnos.reduce((acc, t) => acc + horasTurno(t), 0);
    if (h > emp.horasContrato + 0.1) {
      issues.push(`Exceso de horas: ${h.toFixed(1)} h asignadas (contrato ${emp.horasContrato} h).`);
    }

    // 2. Solapes y descanso entre turnos
    const turnosPorDia = Array.from({ length: 7 }, (_, idx) => 
      empTurnos.filter((t) => t.diaIdx === idx).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
    );

    // Check overlaps within same day
    for (let day = 0; day < 7; day++) {
      const diaTurnos = turnosPorDia[day];
      for (let i = 0; i < diaTurnos.length; i++) {
        for (let j = i + 1; j < diaTurnos.length; j++) {
          const t1 = diaTurnos[i];
          const t2 = diaTurnos[j];
          const t1_start = minutosDeHora(t1.horaInicio);
          const t1_end = minutosDeHora(t1.horaFin);
          const t2_start = minutosDeHora(t2.horaInicio);
          const t2_end = minutosDeHora(t2.horaFin);

          if (t1_start < t2_end && t2_start < t1_end) {
            issues.push(`Solape de turnos el ${DIAS_SEMANA_CORTO[day]}.`);
          }
        }
      }
    }

    // Check rest gap (< 12 hours) between consecutive days
    for (let day = 0; day < 6; day++) {
      const prevDayTurnos = turnosPorDia[day];
      const nextDayTurnos = turnosPorDia[day + 1];
      const tPrev = prevDayTurnos[prevDayTurnos.length - 1];
      const tNext = nextDayTurnos[0];
      if (tPrev && tNext) {
        const prevEnd = minutosDeHora(tPrev.horaFin2 || tPrev.horaFin);
        const nextStart = minutosDeHora(tNext.horaInicio);
        const gap = (nextStart + 24 * 60 - prevEnd) / 60;
        if (gap < 12) {
          issues.push(`Descanso insuficiente (${gap.toFixed(1)} h) entre ${DIAS_SEMANA_CORTO[day]} y ${DIAS_SEMANA_CORTO[day+1]} (mín. 12 h).`);
        }
      }
    }

    // 3. Conflicto con ausencias
    const rec = recomendaciones.find((r) => r.empleadoId === empId);
    if (rec) {
      for (const t of empTurnos) {
        if (rec.diasIdx.includes(t.diaIdx)) {
          issues.push(`Turno asignado durante su ausencia aprobada (${rec.tipo.toLowerCase()}) el ${DIAS_SEMANA_CORTO[t.diaIdx]}.`);
        }
      }
    }

    return issues;
  };
  function editarTurno(t: Turno) {
    if (bloqueado) return;
    setForm({
      turnoId: t.id,
      empleadoId: t.empleadoId,
      diaIdx: t.diaIdx,
      horaInicio: t.horaInicio,
      horaFin: t.horaFin,
      rol: t.rol,
      partido: t.partido,
      horaInicio2: t.horaInicio2 ?? "20:00",
      horaFin2: t.horaFin2 ?? "23:00",
      descansoMin: String(t.descansoMin),
      notas: t.notas ?? "",
    });
  }

  async function guardarTurno() {
    if (!form) return;
    setGuardando(true);
    const payload = {
      empleadoId: form.empleadoId,
      diaISO: diasISO[form.diaIdx],
      horaInicio: form.horaInicio,
      horaFin: form.horaFin,
      rol: form.rol,
      partido: form.partido,
      horaInicio2: form.partido ? form.horaInicio2 : "",
      horaFin2: form.partido ? form.horaFin2 : "",
      descansoMin: form.descansoMin,
      notas: form.notas,
    };
    const res = form.turnoId
      ? await actualizarTurno(form.turnoId, payload)
      : await crearTurno(ubicacionId, semanaISO, payload);
    setGuardando(false);
    if (res.ok) {
      toast.success("Turno guardado");
      setForm(null);
      router.refresh();
    } else toast.error(res.error);
  }
  async function borrarTurno() {
    if (!form?.turnoId) return;
    setGuardando(true);
    const res = await eliminarTurno(form.turnoId);
    setGuardando(false);
    if (res.ok) {
      toast.success("Turno eliminado");
      setForm(null);
      router.refresh();
    } else toast.error(res.error);
  }

  async function publicar() {
    const res = await publicarCuadrante(ubicacionId, semanaISO);
    if (res.ok) {
      toast.success("Cuadrante publicado · Descargando Excel...");
      router.refresh();
      window.location.href = `/api/export/cuadrante?ubicacion=${ubicacionId}&semana=${semanaISO}`;
    } else {
      toast.error(res.error);
    }
  }

  async function generarAuto() {
    setConfirmAiOpen(false);

    const p = (async () => {
      const res = await generarPreviewIA(
        ubicacionId,
        semanaISO,
        "Genera la semana de forma equilibrada. Si es necesario para cumplir con las coberturas mínimas de la ubicación, se pueden asignar horas extras a los empleados (superando sus horas de contrato)."
      );
      if (!res.ok) throw new Error(res.error || "Error al generar la propuesta");
      if (!res.data) throw new Error("Error al generar la propuesta");

      const appRes = await aplicarPreviewIA(ubicacionId, semanaISO, res.data.turnos as any);
      if (!appRes.ok) throw new Error(appRes.error || "Error al aplicar el cuadrante");
      
      return true;
    })();

    toast.promise(p, {
      loading: "Analizando reglas y generando cuadrante con IA...",
      success: () => {
        router.refresh();
        return "Cuadrante generado automáticamente";
      },
      error: (err) => err.message
    });
  }

  async function deshacer() {
    const res = await deshacerGeneracion(ubicacionId, semanaISO);
    res.ok ? toast.success("Generación deshecha") : toast.error(res.error);
    router.refresh();
  }

  async function detectar() {
    setDetectando(true);
    const res = await detectarProblemasAction(ubicacionId, semanaISO);
    setDetectando(false);
    if (res.ok) setProblemas(res.data ?? []);
    else toast.error(res.error);
  }

  async function guardarComoPlantilla() {
    const nombre = window.prompt("Nombre de la plantilla:");
    if (!nombre) return;
    const res = await guardarPlantilla(ubicacionId, semanaISO, nombre);
    res.ok ? toast.success("Plantilla guardada") : toast.error(res.error);
    router.refresh();
  }
  async function usarPlantilla(id: string) {
    if (bloqueado) return;
    setCargandoPlantilla(id);
    const res = await aplicarPlantilla(ubicacionId, semanaISO, id);
    setCargandoPlantilla(null);
    if (res.ok) {
      toast.success("Plantilla aplicada");
      setTemplatesOpen(false);
      router.refresh();
    } else toast.error(res.error);
  }

  async function borrarPlantilla(id: string) {
    if (!window.confirm("¿Seguro que quieres eliminar esta plantilla?")) return;
    setCargandoPlantilla(id);
    const res = await eliminarPlantilla(ubicacionId, id);
    setCargandoPlantilla(null);
    if (res.ok) {
      toast.success("Plantilla eliminada");
      router.refresh();
    } else toast.error(res.error);
  }

  return (
    <Tabs defaultValue="planificacion" className="w-full space-y-4">
      <TabsList className="grid w-full max-w-[400px] grid-cols-2">
        <TabsTrigger value="planificacion">Planificación</TabsTrigger>
        <TabsTrigger value="calibracion">Calibración</TabsTrigger>
      </TabsList>

      <TabsContent value="planificacion" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge estado={estado} />
        <div className="flex-1" />
        {puedeDeshacer && (
          <Button variant="outline" size="sm" onClick={deshacer}>
            <Undo2 /> Deshacer Automático
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={detectar} disabled={detectando}>
          {detectando ? <Loader2 className="animate-spin" /> : <AlertTriangle />}
          Detectar problemas
        </Button>
        <Button variant="outline" size="sm" onClick={guardarComoPlantilla}>
          <Save className="mr-1.5 size-4" /> Guardar plantilla
        </Button>
        <Button variant="outline" size="sm" onClick={() => setTemplatesOpen(true)}>
          <LayoutTemplate className="mr-1.5 size-4" /> Plantillas ({plantillas.length})
        </Button>
        <Button
          variant="accent"
          size="sm"
          onClick={() => setConfirmAiOpen(true)}
        >
          <Sparkles /> Generar Automáticamente
        </Button>
        {estado !== "PUBLICADO" && (
          <Button size="sm" onClick={publicar} disabled={bloqueado}>
            <Send /> Publicar
          </Button>
        )}
      </div>

      {/* Recomendaciones por ausencias aprobadas */}
      {recomendaciones.length > 0 && (
        <div className="rounded-lg border border-warning/40 bg-warning-soft/60 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-warning-foreground">
            <Plane className="size-4" /> Recomendaciones de la semana
          </p>
          <ul className="space-y-1 text-sm text-warning-foreground/90">
            {recomendaciones.map((r, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="font-medium">{r.nombre}</span>
                <Badge variant="warning">{r.tipo.toLowerCase()}</Badge>
                <span className="text-muted-foreground">
                  no asignar{" "}
                  {r.diasIdx.map((d) => DIAS_SEMANA_CORTO[d]).join(", ")}. Las plantillas y
                  el sistema respeta estos días.
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Avisos del detector */}
      {problemas && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="size-4 text-warning" /> Detección de problemas
            </p>
            <button onClick={() => setProblemas(null)} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
          {problemas.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="size-4" /> Sin problemas detectados. ¡Buen trabajo!
            </p>
          ) : (
            <ul className="space-y-1.5">
              {problemas.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Badge variant={p.severidad === "alta" ? "danger" : "warning"}>{p.tipo}</Badge>
                  <span>{p.mensaje}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Rejilla (arrastra los turnos para moverlos) */}
      <DndContext sensors={sensores} onDragEnd={onDragEnd}>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <div className="min-w-[900px]">
          {/* Cabecera de días + cobertura */}
          <div className="grid grid-cols-[200px_repeat(7,1fr)] border-b border-border bg-muted/40 text-sm">
            <div className="p-3 font-medium">Empleado</div>
            {DIAS_SEMANA_CORTO.map((d, i) => {
              const cob = cobertura.find((c) => c.diaIdx === i);
              const fecha = new Date(diasISO[i]);
              return (
                <div key={i} className="border-l border-border p-2 text-center">
                  <p className="font-medium">{d}</p>
                  <p className="text-xs text-muted-foreground">{fecha.getDate()}</p>
                  <span
                    className={cn(
                      "mt-1 inline-block h-1.5 w-full rounded-full",
                      cob?.ok ? "bg-success" : "bg-danger"
                    )}
                    title={cob?.ok ? "Cobertura cubierta" : cob?.faltas.map((f) => `${etiquetaRol(f.rol)} ${f.franja}: faltan ${f.faltan}`).join("; ")}
                  />
                </div>
              );
            })}
          </div>

          {/* Filas de empleados */}
          {empleados.map((e) => {
            const h = horasDe(e.id);
            const exceso = h > e.horasContrato + 0.1;
            return (
              <div
                key={e.id}
                className="grid grid-cols-[200px_repeat(7,1fr)] border-b border-border last:border-0"
              >
                <div className="flex items-center gap-2 p-2">
                  <Avatar nombre={iniciales(e.nombre, e.apellidos)} color={e.color ?? colorDeRol(e.rol)} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium">
                        {e.nombre} {e.apellidos}
                      </p>
                      {(() => {
                        const empIssues = getEmpleadoProblemas(e.id);
                        if (empIssues.length === 0) return null;
                        return (
                          <div className="relative group/tooltip inline-block shrink-0">
                            <AlertTriangle className="size-3.5 text-danger cursor-pointer" />
                            <div className="absolute left-6 top-0 hidden group-hover/tooltip:block bg-popover text-popover-foreground text-[11px] p-2 rounded shadow-md border border-border z-[100] w-64 pointer-events-none">
                              <p className="font-semibold text-danger mb-1">Avisos de planificación:</p>
                              <ul className="list-disc list-inside space-y-1">
                                {empIssues.map((msg, idx) => (
                                  <li key={idx} className="whitespace-normal leading-relaxed">{msg}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <p className={cn("text-xs", exceso ? "text-danger" : "text-muted-foreground")}>
                      {horas(h)} / {horas(e.horasContrato)}
                    </p>
                  </div>
                </div>
                {Array.from({ length: 7 }).map((_, dia) => {
                  const celdas = celdasOrden(turnosDe(e.id, dia));
                  const ausente = celdaBloqueada.has(`${e.id}-${dia}`);
                  return (
                    <Celda
                      key={dia}
                      id={`${e.id}|${dia}`}
                      ausente={ausente}
                      vacio={celdas.length === 0}
                      bloqueado={bloqueado}
                      onNuevo={() => nuevoTurno(e.id, dia)}
                    >
                      {celdas.map((t) => (
                        <TurnoChip key={t.id} turno={t} onEdit={() => editarTurno(t)} bloqueado={bloqueado} />
                      ))}
                    </Celda>
                  );
                })}
              </div>
            );
          })}
          {empleados.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No hay empleados en esta ubicación todavía.
            </div>
          )}
        </div>
      </div>
      </DndContext>
      </TabsContent>

      <TabsContent value="calibracion" className="space-y-4">
        <CalibracionIA
          ubicacionId={ubicacionId}
          ajustesJson={ubicacionAjustes}
          horaApertura={ubicHoraApertura}
          horaCierre={ubicHoraCierre}
          empleados={empleados}
          disponibilidades={disponibilidades}
        />
      </TabsContent>

      {/* Drawer: edición de turno */}
      <Sheet open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{form?.turnoId ? "Editar turno" : "Nuevo turno"}</SheetTitle>
            <SheetDescription>Horario, rol y turno partido.</SheetDescription>
          </SheetHeader>
          {form && (
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Empleado</Label>
                  <Select value={form.empleadoId} onValueChange={(v) => setForm({ ...form, empleadoId: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {empleados.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.nombre} {e.apellidos}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Día</Label>
                  <Select value={String(form.diaIdx)} onValueChange={(v) => setForm({ ...form, diaIdx: Number(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DIAS_SEMANA_CORTO.map((d, i) => (
                        <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Entrada</Label>
                  <Input value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Salida</Label>
                  <Input value={form.horaFin} onChange={(e) => setForm({ ...form, horaFin: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Rol</Label>
                <Select value={form.rol} onValueChange={(v) => setForm({ ...form, rol: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES_FUNCIONALES.map((r) => (
                      <SelectItem key={r} value={r}>{etiquetaRol(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <Label>Turno partido</Label>
                <Switch checked={form.partido} onCheckedChange={(v) => setForm({ ...form, partido: v })} />
              </div>
              {form.partido && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>2.º tramo entrada</Label>
                    <Input value={form.horaInicio2} onChange={(e) => setForm({ ...form, horaInicio2: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>2.º tramo salida</Label>
                    <Input value={form.horaFin2} onChange={(e) => setForm({ ...form, horaFin2: e.target.value })} />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Notas</Label>
                <Textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
              </div>
              <div className="flex items-center justify-between pt-2">
                {form.turnoId ? (
                  <Button variant="ghost" className="text-danger" onClick={borrarTurno} disabled={guardando}>
                    <Trash2 /> Eliminar
                  </Button>
                ) : (
                  <span />
                )}
                <Button onClick={guardarTurno} disabled={guardando}>
                  {guardando && <Loader2 className="animate-spin" />} Guardar
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={confirmAiOpen} onOpenChange={setConfirmAiOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-accent" />
              <DialogTitle>Generar cuadrante</DialogTitle>
            </div>
            <DialogDescription>
              El sistema utilizará la Inteligencia Artificial para crear el mejor horario posible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm">
              ¿Seguro que quieres generar el cuadrante automáticamente?
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" /> Se cogerán los roles y horas.</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" /> Se respetarán las disponibilidades.</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" /> Se aplicarán las reglas de negocio.</li>
            </ul>
            <Button onClick={generarAuto} className="w-full mt-2" size="lg" variant="accent">
              <Sparkles className="mr-2 size-4" /> Confirmar y generar
            </Button>
          </div>
        </DialogContent>
      </Dialog>



      {/* Drawer: plantillas */}
      <Sheet open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <LayoutTemplate className="size-5 text-primary" /> Plantillas guardadas
            </SheetTitle>
            <SheetDescription>
              Aplica un cuadrante guardado o elimina plantillas que ya no uses.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-5">
            {plantillas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <LayoutTemplate className="mb-2 size-8 text-muted-foreground/60" />
                <p className="text-sm font-medium">No tienes ninguna plantilla</p>
                <p className="text-xs text-muted-foreground max-w-[200px] mt-1">
                  Usa el botón &quot;Guardar plantilla&quot; de la barra de herramientas para guardar el cuadrante actual.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {plantillas.map((p) => {
                  const cargando = cargandoPlantilla === p.id;
                  return (
                    <li key={p.id} className="flex items-center justify-between py-3">
                      <span className="text-sm font-medium truncate max-w-[180px]">{p.nombre}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={cargando || bloqueado}
                          onClick={() => usarPlantilla(p.id)}
                        >
                          {cargando ? <Loader2 className="size-3 animate-spin" /> : "Aplicar"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={cargando}
                          onClick={() => borrarPlantilla(p.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </Tabs>
  );
}

function celdasOrden(t: Turno[]) {
  return [...t].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
}

/** Celda del cuadrante (empleado×día): zona donde soltar turnos. */
function Celda({
  id,
  ausente,
  vacio,
  bloqueado,
  onNuevo,
  children,
}: {
  id: string;
  ausente: boolean;
  vacio: boolean;
  bloqueado: boolean;
  onNuevo: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: ausente });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group min-h-[64px] border-l border-border p-1",
        ausente && "bg-warning-soft/40",
        isOver && !ausente && "bg-primary/10 ring-1 ring-inset ring-primary/40"
      )}
      onClick={() => vacio && !ausente && !bloqueado && onNuevo()}
    >
      {ausente && vacio ? (
        <div className="flex h-full w-full items-center justify-center">
          <span className="flex items-center gap-1 text-[11px] font-medium text-warning-foreground/70">
            <Plane className="size-3" /> Ausencia
          </span>
        </div>
      ) : vacio ? (
        !bloqueado && (
          <div className="flex h-full w-full items-center justify-center rounded text-muted-foreground/0 transition group-hover:text-muted-foreground">
            <Plus className="size-4" />
          </div>
        )
      ) : (
        <div className="space-y-1">{children}</div>
      )}
    </div>
  );
}

/** Tarjeta de turno arrastrable (drag) que sigue siendo clicable (editar). */
function TurnoChip({
  turno,
  onEdit,
  bloqueado,
}: {
  turno: Turno;
  onEdit: () => void;
  bloqueado: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: turno.id,
    disabled: bloqueado,
  });
  const style: React.CSSProperties = {
    borderColor: colorDeRol(turno.rol),
    opacity: isDragging ? 0.4 : 1,
    ...(transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 } : {}),
  };
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(ev) => {
        ev.stopPropagation();
        onEdit();
      }}
      style={style}
      className="block w-full cursor-grab touch-none rounded border-l-[3px] bg-muted/50 px-1.5 py-1 text-left text-xs hover:bg-muted active:cursor-grabbing"
    >
      <span className="font-medium">
        {turno.horaInicio}–{turno.horaFin}
      </span>
      {turno.partido && (
        <span className="text-muted-foreground">
          {" "}
          +{turno.horaInicio2}–{turno.horaFin2}
        </span>
      )}
    </button>
  );
}
