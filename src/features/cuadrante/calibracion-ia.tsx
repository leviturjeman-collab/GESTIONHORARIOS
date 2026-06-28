"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Save,
  Loader2,
  Clock,
  Users,
  AlertTriangle,
  Plus,
  Trash2,
  CalendarRange,
  Info,
  Sparkles,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ROLES_FUNCIONALES, etiquetaRol } from "@/lib/enums";
import {
  guardarCalibracion,
  eliminarDisponibilidad,
  crearDisponibilidadAction,
  actualizarContratoDescansos,
  actualizarEmpleadoCompleto,
  toggleDisponibilidadActivaAction,
} from "@/features/cuadrante/actions";

type Emp = {
  id: string;
  nombre: string;
  apellidos: string | null;
  rol: string;
  color: string | null;
  horasContrato: number;
  diasDescanso: number;
  tipoContrato: string;
  preferenciaTurno: string;
  permitePartido: boolean;
  admiteHorasExtra: boolean;
};

type Disponibilidad = {
  id: string;
  empleadoId: string;
  recurrente: boolean;
  diaSemana: number | null;
  fecha: Date | null;
  franjaInicio: string;
  franjaFin: string;
  estado: string;
  notas: string | null;
  activa: boolean;
};

export function CalibracionIA({
  ubicacionId,
  ajustesJson,
  horaApertura,
  horaCierre,
  empleados,
  disponibilidades,
}: {
  ubicacionId: string;
  ajustesJson: string;
  horaApertura: string;
  horaCierre: string;
  empleados: Emp[];
  disponibilidades: any[];
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [cargandoAccion, setCargandoAccion] = useState<string | null>(null);

  const [respuestas, setRespuestas] = useState<Record<number, string>>({});
  const [subRespuestas, setSubRespuestas] = useState<Record<string, boolean | string>>({});
  const [detallesRestricciones, setDetallesRestricciones] = useState<Record<string, { tipo: "dia" | "turno" | "otro"; dia?: number; turno?: string; notas?: string }>>({});
  const [curvaDemanda, setCurvaDemanda] = useState<{ inicio: string, fin: string, roles: Record<string, number> }[]>([
    { inicio: "11:00", fin: "13:00", roles: { cocinero: 1, camarero: 1 } },
    { inicio: "13:00", fin: "14:00", roles: { cocinero: 2, camarero: 2 } },
    { inicio: "14:00", fin: "17:00", roles: { cocinero: 3, camarero: 4 } },
  ]);


  // Parsear ajustes de la ubicación
  const ajustes = ajustesJson ? JSON.parse(ajustesJson) : {};
  const currentHorarioCustom = ajustes.horarioCustom || {
    aperturaSemana: horaApertura || "09:00",
    cierreSemana: horaCierre || "23:00",
    diferenteFinSemana: false,
    aperturaFinSemana: horaApertura || "09:00",
    cierreFinSemana: horaCierre || "23:00",
    diasCierre: [] as number[],
  };

  const [form, setForm] = useState({
    aperturaSemana: currentHorarioCustom.aperturaSemana || "09:00",
    cierreSemana: currentHorarioCustom.cierreSemana || "23:00",
    diferenteFinSemana: currentHorarioCustom.diferenteFinSemana ?? false,
    aperturaFinSemana: currentHorarioCustom.aperturaFinSemana || "09:00",
    cierreFinSemana: currentHorarioCustom.cierreFinSemana || "23:00",
    diasCierre: (currentHorarioCustom.diasCierre || []) as number[],
  });

  const [rolesPartido, setRolesPartido] = useState<string[]>(
    ajustes.rolesTurnoPartido || []
  );

  // Estado para creación de disponibilidad individual
  const [nuevaDisp, setNuevaDisp] = useState({
    empleadoId: "",
    diaSemana: "0", // "0" a "6"
    estado: "NO_DISPONIBLE",
    franjaInicio: "00:00",
    franjaFin: "23:59",
    notas: "",
  });
  const [nuevaDispOpen, setNuevaDispOpen] = useState(false);

  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        nombreCompleto: string;
        rol: string;
        tipoContrato: string;
        horasSemana: number;
        diasDescanso: number;
        preferenciaTurno: string;
        permitePartido: boolean;
        admiteHorasExtra: boolean;
      }
    >
  >({});

  const getDraft = (emp: Emp) => {
    const draft = drafts[emp.id];
    if (draft) return draft;
    return {
      nombreCompleto: `${emp.nombre} ${emp.apellidos ?? ""}`.trim(),
      rol: emp.rol,
      tipoContrato: emp.tipoContrato.includes("PARCIAL") ? "PARCIAL" : "COMPLETO",
      horasSemana: emp.horasContrato,
      diasDescanso: emp.diasDescanso,
      preferenciaTurno: emp.preferenciaTurno || "INDIFERENTE",
      permitePartido: emp.permitePartido ?? true,
      admiteHorasExtra: emp.admiteHorasExtra ?? true,
    };
  };

  const updateDraft = (empId: string, fields: Partial<Record<string, any>>) => {
    setDrafts((prev) => ({
      ...prev,
      [empId]: {
        ...(prev[empId] || {
          nombreCompleto: "",
          rol: "",
          tipoContrato: "COMPLETO",
          horasSemana: 40,
          diasDescanso: 2,
          preferenciaTurno: "INDIFERENTE",
          permitePartido: true,
          admiteHorasExtra: true,
        }),
        ...fields,
      } as any,
    }));
  };

  const isDirty = (emp: Emp) => {
    const draft = drafts[emp.id];
    if (!draft) return false;
    const originalNombre = `${emp.nombre} ${emp.apellidos ?? ""}`.trim();
    const originalTipo = emp.tipoContrato.includes("PARCIAL") ? "PARCIAL" : "COMPLETO";
    return (
      draft.nombreCompleto !== originalNombre ||
      draft.rol !== emp.rol ||
      draft.tipoContrato !== originalTipo ||
      Number(draft.horasSemana) !== emp.horasContrato ||
      Number(draft.diasDescanso) !== emp.diasDescanso ||
      draft.preferenciaTurno !== (emp.preferenciaTurno || "INDIFERENTE") ||
      draft.permitePartido !== (emp.permitePartido ?? true) ||
      draft.admiteHorasExtra !== (emp.admiteHorasExtra ?? true)
    );
  };

  async function guardarEmpleado(empId: string) {
    const draft = getDraft(empleados.find((e) => e.id === empId)!);
    const parts = draft.nombreCompleto.trim().split(" ");
    const nombre = parts[0] || "";
    const apellidos = parts.slice(1).join(" ") || null;
    const tipoContrato = draft.tipoContrato === "PARCIAL" ? "INDEFINIDO_PARCIAL" : "INDEFINIDO_COMPLETO";

    setCargandoAccion(`save-emp-${empId}`);
    const res = await actualizarEmpleadoCompleto(ubicacionId, empId, {
      nombre,
      apellidos,
      rolFuncional: draft.rol,
      tipoContrato,
      horasSemana: Number(draft.horasSemana),
      diasDescanso: Number(draft.diasDescanso),
      preferenciaTurno: draft.preferenciaTurno,
      permitePartido: draft.permitePartido,
      admiteHorasExtra: draft.admiteHorasExtra,
    });
    setCargandoAccion(null);
    if (res.ok) {
      toast.success("Empleado actualizado");
      setDrafts((prev) => {
        const copy = { ...prev };
        delete copy[empId];
        return copy;
      });
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function cambiarActivaDisponibilidad(dispId: string, activa: boolean) {
    const actId = `act-${dispId}`;
    setCargandoAccion(actId);
    const res = await toggleDisponibilidadActivaAction(ubicacionId, dispId, activa);
    setCargandoAccion(null);
    if (res.ok) {
      toast.success(activa ? "Restricción activada" : "Restricción desactivada");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  function toggleDiaCierre(diaIdx: number) {
    setForm((prev) => {
      const nextDias = prev.diasCierre.includes(diaIdx)
        ? prev.diasCierre.filter((d) => d !== diaIdx)
        : [...prev.diasCierre, diaIdx];
      return { ...prev, diasCierre: nextDias };
    });
  }

  function toggleRolPartido(rol: string) {
    setRolesPartido((prev) =>
      prev.includes(rol) ? prev.filter((r) => r !== rol) : [...prev, rol]
    );
  }

  
  async function guardarRespuestasNuevas() {
    setGuardando(true);
    try {
      const respuestasParaServer: Record<string, string> = {};
      Object.entries(respuestas).forEach(([qIdx, optionIdx]) => {
        const numQ = Number(qIdx);
        const q = ajustes.preguntasOnboarding?.[numQ];
        if (q) {
          respuestasParaServer[qIdx] = q.opciones[Number(optionIdx)] || optionIdx;
        } else {
          respuestasParaServer[qIdx] = optionIdx;
        }
      });
      // Añadir también las notas manuales de texto libre
      Object.entries(subRespuestas).forEach(([key, val]) => {
        if (key.endsWith("_manual_txt") && val && typeof val === "string") {
          respuestasParaServer[key] = val;
        }
      });
      
      const { guardarRespuestasCalibracion } = await import("./actions");
      const res = await guardarRespuestasCalibracion(ubicacionId, {
        respuestas: respuestasParaServer,
        curvaDemanda,
        subRespuestas
      });
      
      if (res.ok) {
        toast.success("Configuración guardada correctamente");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch (err) {
      toast.error("Error al guardar");
    } finally {
      setGuardando(false);
    }
  }


  async function guardar() {
    setGuardando(true);
    const res = await guardarCalibracion(ubicacionId, {
      horarioCustom: {
        aperturaSemana: form.aperturaSemana,
        cierreSemana: form.cierreSemana,
        diferenteFinSemana: form.diferenteFinSemana,
        aperturaFinSemana: form.diferenteFinSemana ? form.aperturaFinSemana : form.aperturaSemana,
        cierreFinSemana: form.diferenteFinSemana ? form.cierreFinSemana : form.cierreSemana,
        diasCierre: form.diasCierre,
      },
      rolesTurnoPartido: rolesPartido,
    });
    setGuardando(false);
    if (res.ok) {
      toast.success("Calibración del Sistema guardada correctamente");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function cambiarDescansos(empleadoId: string, descansos: number) {
    const actId = `desc-${empleadoId}`;
    setCargandoAccion(actId);
    const res = await actualizarContratoDescansos(ubicacionId, empleadoId, descansos);
    setCargandoAccion(null);
    if (res.ok) {
      toast.success("Días de descanso actualizados");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function borrarRestriccion(dispId: string) {
    if (!window.confirm("¿Seguro que quieres eliminar esta restricción?")) return;
    setCargandoAccion(`del-${dispId}`);
    const res = await eliminarDisponibilidad(ubicacionId, dispId);
    setCargandoAccion(null);
    if (res.ok) {
      toast.success("Restricción eliminada");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function crearRestriccion() {
    if (!nuevaDisp.empleadoId) return;
    setCargandoAccion("add-disp");
    const res = await crearDisponibilidadAction(ubicacionId, nuevaDisp.empleadoId, {
      diaSemana: Number(nuevaDisp.diaSemana),
      estado: nuevaDisp.estado,
      franjaInicio: nuevaDisp.franjaInicio,
      franjaFin: nuevaDisp.franjaFin,
      notas: nuevaDisp.notas || undefined,
    });
    setCargandoAccion(null);
    if (res.ok) {
      toast.success("Restricción añadida");
      setNuevaDispOpen(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const DIAS_NOMBRES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

  return (
    <div className="space-y-6">
      
      {/* 0. Preguntas de calibración de la IA (mostradas desde el onboarding) */}
      {Array.isArray(ajustes.preguntasOnboarding) && ajustes.preguntasOnboarding.length > 0 ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Sparkles className="size-5" /> Por favor, finaliza la configuración de tu local
            </CardTitle>
            <CardDescription>
              Responde estas preguntas para que podamos generar tu cuadrante de forma automática y precisa.
            </CardDescription>
          </CardHeader>
          <CardContent>
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-5 pt-5">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="size-4 text-accent" /> Necesitamos algunos detalles
                para planificar mejor
              </p>
              {(ajustes.preguntasOnboarding).map((q: {pregunta: string, opciones: string[]}, i: number) => {
                const seleccion = respuestas[i] ?? "";
                const pregLower = q.pregunta.toLowerCase();
                const esRestricciones = pregLower.includes("restriccion") || pregLower.includes("preferencia");
                const esPartido = pregLower.includes("partido") || pregLower.includes("partida");
                const mostrarEmpleados = esRestricciones && seleccion.toLowerCase().includes("algunos");
                const mostrarRoles = esPartido && seleccion !== "" && !seleccion.toLowerCase().includes("ninguno") && !seleccion.toLowerCase().includes("todos");

                const esHorario = pregLower.includes("apertura") || pregLower.includes("cierre") || pregLower.includes("horario");
                const esAnomalia = pregLower.includes("tabla resumen") || pregLower.includes("detectado") || pregLower.includes("aparece") || pregLower.includes("documento");
                const tieneOtro = q.opciones.some(o => {
                  const opLower = o.toLowerCase();
                  return opLower.includes("otro") || opLower.includes("manualmente") || opLower.includes("especificar");
                });
                const opcionesMostradas = tieneOtro ? q.opciones : [...q.opciones, "Otro (especificar)"];

                return (
                  <div key={i} className="space-y-2">
                    <p className="text-sm font-medium">{q.pregunta}</p>
                    <div className="flex flex-wrap gap-2">
                      {opcionesMostradas.map((opcion: string) => (
                        <button
                          key={opcion}
                          type="button"
                          onClick={() => {
                            setRespuestas((r) => {
                              const newRes = { ...r, [i]: r[i] === opcion ? "" : opcion };
                              const isSelected = r[i] !== opcion;
                              
                              if (esHorario) {
                                const match = opcion.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
                                if (match) {
                                  const open = match[1].padStart(5, '0');
                                  const close = match[2].padStart(5, '0');
                                  setForm((prev) => ({ ...prev, aperturaSemana: open, cierreSemana: close }));
                                }
                              }
                              
                              if (esPartido) {
                                const opLower = opcion.toLowerCase();
                                setSubRespuestas((prev) => {
                                  const next = { ...prev };
                                  if (isSelected) {
                                    if (opLower.includes("todos")) {
                                      ROLES_FUNCIONALES.forEach((rol) => {
                                        next[`${i}_rol_${rol}`] = true;
                                      });
                                    } else if (opLower.includes("ninguno")) {
                                      ROLES_FUNCIONALES.forEach((rol) => {
                                        next[`${i}_rol_${rol}`] = false;
                                      });
                                    }
                                  }
                                  return next;
                                });
                              }
                              
                              if (esRestricciones) {
                                const opLower = opcion.toLowerCase();
                                setSubRespuestas((prev) => {
                                  const next = { ...prev };
                                  if (isSelected) {
                                    if (opLower.includes("ninguno") || opLower.includes("no")) {
                                      empleados.forEach((emp) => {
                                        next[`${i}_emp_${emp.nombre}`] = false;
                                      });
                                      setDetallesRestricciones({});
                                    } else if (opLower.includes("todos") || opLower.includes("sí") || opLower.includes("si")) {
                                      if (!opLower.includes("algunos")) {
                                        empleados.forEach((emp) => {
                                          const empKey = `${i}_emp_${emp.nombre}`;
                                          next[empKey] = true;
                                          setDetallesRestricciones((prevD) => ({
                                            ...prevD,
                                            [empKey]: { tipo: "dia", dia: 6 }
                                          }));
                                        });
                                      }
                                    }
                                  }
                                  return next;
                                });
                              }
                              
                              return newRes;
                            });
                          }}
                          className={cn(
                            "rounded-full border px-4 py-1.5 text-sm font-medium transition-all",
                            seleccion === opcion
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted"
                          )}
                        >
                          {opcion}
                        </button>
                      ))}
                    </div>

                    {esHorario && seleccion === "Otro" && (
                      <div className="mt-2 flex flex-col gap-4 rounded-lg border border-dashed border-border bg-muted/20 p-4 w-full">
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex flex-col gap-1.5">
                            <Label className="text-xs font-semibold">Horario de apertura (Lunes a Viernes)</Label>
                            <Input
                              type="time"
                              className="h-8 w-32"
                              value={form.aperturaSemana}
                              onChange={(ev) => {
                                const val = ev.target.value;
                                setForm((prev) => ({ ...prev, aperturaSemana: val }));
                              }}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label className="text-xs font-semibold">Horario de cierre (Lunes a Viernes)</Label>
                            <Input
                              type="time"
                              className="h-8 w-32"
                              value={form.cierreSemana}
                              onChange={(ev) => {
                                const val = ev.target.value;
                                setForm((prev) => ({ ...prev, cierreSemana: val }));
                              }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 rounded-md border border-border/60 p-2 bg-background/50">
                          <Switch
                            id="dif-fin-semana"
                            checked={form.diferenteFinSemana}
                            onCheckedChange={(val) => setForm((prev) => ({ ...prev, diferenteFinSemana: val }))}
                          />
                          <Label htmlFor="dif-fin-semana" className="text-xs cursor-pointer font-semibold">
                            ¿Tiene horario diferente el fin de semana (Sábado y Domingo)?
                          </Label>
                        </div>

                        {form.diferenteFinSemana && (
                          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border/40">
                            <div className="flex flex-col gap-1.5">
                              <Label className="text-xs font-semibold">Apertura Fin de Semana</Label>
                              <Input
                                type="time"
                                className="h-8 w-32"
                                value={form.aperturaFinSemana}
                                onChange={(ev) => setForm((prev) => ({ ...prev, aperturaFinSemana: ev.target.value }))}
                              />
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <Label className="text-xs font-semibold">Cierre Fin de Semana</Label>
                              <Input
                                type="time"
                                className="h-8 w-32"
                                value={form.cierreFinSemana}
                                onChange={(ev) => setForm((prev) => ({ ...prev, cierreFinSemana: ev.target.value }))}
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
                                    setForm((prev) => {
                                      const nextDias = isClosed
                                        ? prev.diasCierre.filter((d) => d !== dayIdx)
                                        : [...prev.diasCierre, dayIdx];
                                      return { ...prev, diasCierre: nextDias };
                                    });
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
                      </div>
                    )}

                     {/* Sub-selección: empleados con restricciones */}
                    {mostrarEmpleados && (
                      <div className="mt-2 rounded-lg border border-dashed border-border bg-muted/20 p-3 space-y-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">
                            Selecciona los empleados con restricciones:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {empleados.map((emp) => {
                              const key = `${i}_emp_${emp.nombre}`;
                              const sel = (subRespuestas[key] ?? false);
                              return (
                                <button
                                  key={emp.nombre}
                                  type="button"
                                  onClick={() => {
                                    setSubRespuestas((r) => {
                                      const nextVal = !sel;
                                      if (nextVal) {
                                        setDetallesRestricciones((prev) => ({
                                          ...prev,
                                          [key]: { tipo: "dia", dia: 6 }
                                        }));
                                      } else {
                                        setDetallesRestricciones((prev) => {
                                          const copy = { ...prev };
                                          delete copy[key];
                                          return copy;
                                        });
                                      }
                                      return { ...r, [key]: nextVal };
                                    });
                                  }}
                                  className={cn(
                                    "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                                    sel
                                      ? "border-warning bg-warning/10 text-warning-foreground shadow-sm"
                                      : "border-border bg-background text-foreground hover:bg-muted"
                                  )}
                                >
                                  {emp.nombre}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Configuración detallada por empleado seleccionado */}
                        {empleados.filter((emp) => subRespuestas[`${i}_emp_${emp.nombre}`]).length > 0 && (
                          <div className="border-t border-border/60 pt-3 space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground">
                              Especifica las restricciones de cada empleado seleccionado:
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2">
                              {empleados
                                .filter((emp) => subRespuestas[`${i}_emp_${emp.nombre}`])
                                .map((emp) => {
                                  const key = `${i}_emp_${emp.nombre}`;
                                  const det = detallesRestricciones[key] || { tipo: "dia", dia: 6 };
                                  return (
                                    <div
                                      key={emp.nombre}
                                      className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3 shadow-sm"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold">{emp.nombre}</span>
                                        <span className="text-xs text-muted-foreground">Restricción</span>
                                      </div>

                                      <div className="flex flex-wrap gap-2 items-center">
                                        {/* Opciones de tipo de restricción */}
                                        <div className="flex gap-1 border rounded-lg p-0.5 bg-muted text-xs">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setDetallesRestricciones((prev) => ({
                                                ...prev,
                                                [key]: { ...det, tipo: "dia" },
                                              }))
                                            }
                                            className={cn(
                                              "px-2 py-0.5 rounded-md font-medium transition-all",
                                              det.tipo === "dia"
                                                ? "bg-background text-foreground shadow-sm"
                                                : "text-muted-foreground"
                                            )}
                                          >
                                            Día libre
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setDetallesRestricciones((prev) => ({
                                                ...prev,
                                                [key]: { ...det, tipo: "turno" },
                                              }))
                                            }
                                            className={cn(
                                              "px-2 py-0.5 rounded-md font-medium transition-all",
                                              det.tipo === "turno"
                                                ? "bg-background text-foreground shadow-sm"
                                                : "text-muted-foreground"
                                            )}
                                          >
                                            Turno
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setDetallesRestricciones((prev) => ({
                                                ...prev,
                                                [key]: { ...det, tipo: "otro" },
                                              }))
                                            }
                                            className={cn(
                                              "px-2 py-0.5 rounded-md font-medium transition-all",
                                              det.tipo === "otro"
                                                ? "bg-background text-foreground shadow-sm"
                                                : "text-muted-foreground"
                                            )}
                                          >
                                            Otro / Notas
                                          </button>
                                        </div>

                                        {/* Si es Día Libre Específico: mostrar los días de la semana */}
                                        {det.tipo === "dia" && (
                                          <div className="flex flex-wrap gap-1">
                                            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d, dIdx) => (
                                              <button
                                                key={d}
                                                type="button"
                                                onClick={() =>
                                                  setDetallesRestricciones((prev) => ({
                                                    ...prev,
                                                    [key]: { ...det, dia: dIdx },
                                                  }))
                                                }
                                                className={cn(
                                                  "h-6 px-1.5 rounded text-[11px] font-semibold border transition-all",
                                                  det.dia === dIdx
                                                    ? "border-warning bg-warning/10 text-warning shadow-sm"
                                                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                                                )}
                                              >
                                                {d}
                                              </button>
                                            ))}
                                          </div>
                                        )}

                                        {/* Si es Turno No Disponible: mostrar opciones de turnos */}
                                        {det.tipo === "turno" && (
                                          <div className="flex gap-1">
                                            {[
                                              { label: "Mañana", val: "MAÑANA" },
                                              { label: "Tarde", val: "TARDE" },
                                              { label: "Noche", val: "NOCHE" },
                                            ].map((t) => (
                                              <button
                                                key={t.val}
                                                type="button"
                                                onClick={() =>
                                                  setDetallesRestricciones((prev) => ({
                                                    ...prev,
                                                    [key]: { ...det, turno: t.val },
                                                  }))
                                                }
                                                className={cn(
                                                  "h-6 px-1.5 rounded text-[11px] font-semibold border transition-all",
                                                  det.turno === t.val
                                                    ? "border-warning bg-warning/10 text-warning shadow-sm"
                                                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                                                )}
                                              >
                                                {t.label}
                                              </button>
                                            ))}
                                          </div>
                                        )}

                                        {/* Si es Otra cosa / Notas: mostrar input de texto */}
                                        {det.tipo === "otro" && (
                                          <Input
                                            className="h-6 text-xs w-44 px-2 py-1"
                                            placeholder="Notas (ej. no puede tardes)"
                                            value={det.notas || ""}
                                            onChange={(e) =>
                                              setDetallesRestricciones((prev) => ({
                                                ...prev,
                                                [key]: { ...det, notas: e.target.value },
                                              }))
                                            }
                                          />
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sub-selección: roles para turno partido */}
                    {mostrarRoles && (
                      <div className="mt-2 rounded-lg border border-dashed border-border bg-muted/20 p-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Selecciona los roles que pueden hacer turno partido:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {ROLES_FUNCIONALES.map((rol) => {
                            const key = `${i}_rol_${rol}`;
                            const sel = (subRespuestas[key] ?? false);
                            return (
                              <button
                                key={rol}
                                type="button"
                                onClick={() =>
                                  setSubRespuestas((r) => ({ ...r, [key]: !sel }))
                                }
                                className={cn(
                                  "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                                  sel
                                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                                    : "border-border bg-background text-foreground hover:bg-muted"
                                )}
                              >
                                {etiquetaRol(rol)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── Panel interactivo: "Configurar manualmente" ── */}
                    {seleccion === "Configurar manualmente" && (() => {
                      // Detectar qué tipo de pregunta es para mostrar el input adecuado
                      const esCobertura = pregLower.includes("cobertura") || pregLower.includes("hora punta");
                      const esDiasConsecutivos = pregLower.includes("días seguidos") || pregLower.includes("consecutiv");
                      const esDescansoTurnos = pregLower.includes("descanso mínimo") || pregLower.includes("horas de descanso");
                      const esFinSemana = pregLower.includes("fines de semana") || pregLower.includes("fin de semana");
                      const esDiasFijos = pregLower.includes("días de descanso fijos") || pregLower.includes("días fijos");
                      const esDiaCierre = pregLower.includes("cierre semanal");
                      const esDiasFuertes = pregLower.includes("días fuertes") || pregLower.includes("días con más personal");
                      const esFlexRol = pregLower.includes("polivalente") || pregLower.includes("cubrir un rol diferente");

                      return (
                        <div className="mt-2 rounded-lg border border-dashed border-border bg-muted/20 p-4 space-y-3 animate-in fade-in-0 slide-in-from-top-1">
                          {/* Cobertura mínima → input numérico */}
                          {esCobertura && (
                            <div className="flex items-center gap-3">
                              <Label className="text-xs font-semibold whitespace-nowrap">Mínimo de personas:</Label>
                              <Input
                                type="number"
                                min={1}
                                max={50}
                                className="h-8 w-20"
                                value={String(subRespuestas[`${i}_manual_num`] ?? "")}
                                onChange={(e) =>
                                  setSubRespuestas((r) => ({ ...r, [`${i}_manual_num`]: e.target.value }))
                                }
                                placeholder="Ej: 3"
                              />
                            </div>
                          )}

                          {/* Días consecutivos → input numérico */}
                          {esDiasConsecutivos && (
                            <div className="flex items-center gap-3">
                              <Label className="text-xs font-semibold whitespace-nowrap">Máximo días seguidos:</Label>
                              <Input
                                type="number"
                                min={1}
                                max={7}
                                className="h-8 w-20"
                                value={String(subRespuestas[`${i}_manual_num`] ?? "")}
                                onChange={(e) =>
                                  setSubRespuestas((r) => ({ ...r, [`${i}_manual_num`]: e.target.value }))
                                }
                                placeholder="Ej: 5"
                              />
                            </div>
                          )}

                          {/* Descanso entre turnos → input numérico de horas */}
                          {esDescansoTurnos && (
                            <div className="flex items-center gap-3">
                              <Label className="text-xs font-semibold whitespace-nowrap">Horas de descanso mínimo:</Label>
                              <Input
                                type="number"
                                min={4}
                                max={24}
                                className="h-8 w-20"
                                value={String(subRespuestas[`${i}_manual_num`] ?? "")}
                                onChange={(e) =>
                                  setSubRespuestas((r) => ({ ...r, [`${i}_manual_num`]: e.target.value }))
                                }
                                placeholder="Ej: 12"
                              />
                            </div>
                          )}

                          {/* Día de cierre → checkboxes de días */}
                          {esDiaCierre && (
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold">Selecciona los días de cierre:</Label>
                              <div className="flex flex-wrap gap-1.5">
                                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((dayName, dayIdx) => {
                                  const key = `${i}_dia_${dayIdx}`;
                                  const sel = subRespuestas[key] ?? false;
                                  return (
                                    <button
                                      key={dayName}
                                      type="button"
                                      onClick={() => setSubRespuestas((r) => ({ ...r, [key]: !sel }))}
                                      className={cn(
                                        "px-3 py-1 rounded text-xs font-medium border transition-all",
                                        sel
                                          ? "border-destructive bg-destructive/10 text-destructive shadow-sm"
                                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                                      )}
                                    >
                                      {dayName} {sel && "(Cerrado)"}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Días fuertes → checkboxes de días */}
                          {esDiasFuertes && (
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold">Selecciona los días fuertes:</Label>
                              <div className="flex flex-wrap gap-1.5">
                                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((dayName, dayIdx) => {
                                  const key = `${i}_dia_${dayIdx}`;
                                  const sel = subRespuestas[key] ?? false;
                                  return (
                                    <button
                                      key={dayName}
                                      type="button"
                                      onClick={() => setSubRespuestas((r) => ({ ...r, [key]: !sel }))}
                                      className={cn(
                                        "px-3 py-1 rounded text-xs font-medium border transition-all",
                                        sel
                                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                                      )}
                                    >
                                      {dayName} {sel && "★"}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Fines de semana → selector de empleados con fin de semana fijo */}
                          {esFinSemana && (
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">¿Qué empleados tienen el fin de semana fijo libre?</Label>
                              <div className="flex flex-wrap gap-1.5">
                                {empleados.map((emp) => {
                                  const key = `${i}_emp_${emp.nombre}`;
                                  const sel = subRespuestas[key] ?? false;
                                  return (
                                    <button
                                      key={emp.nombre}
                                      type="button"
                                      onClick={() => setSubRespuestas((r) => ({ ...r, [key]: !sel }))}
                                      className={cn(
                                        "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                                        sel
                                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                                          : "border-border bg-background text-foreground hover:bg-muted"
                                      )}
                                    >
                                      {emp.nombre} {sel && "✓"}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Flexibilidad de roles → selector de empleados polivalentes */}
                          {esFlexRol && (
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">¿Qué empleados son polivalentes?</Label>
                              <div className="flex flex-wrap gap-1.5">
                                {empleados.map((emp) => {
                                  const key = `${i}_emp_${emp.nombre}`;
                                  const sel = subRespuestas[key] ?? false;
                                  return (
                                    <button
                                      key={emp.nombre}
                                      type="button"
                                      onClick={() => setSubRespuestas((r) => ({ ...r, [key]: !sel }))}
                                      className={cn(
                                        "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                                        sel
                                          ? "border-accent bg-accent/10 text-accent shadow-sm"
                                          : "border-border bg-background text-foreground hover:bg-muted"
                                      )}
                                    >
                                      {emp.nombre} ({emp.rol}) {sel && "✓"}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Días de descanso fijos → selector empleado + día */}
                          {esDiasFijos && (
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">Selecciona empleados con días fijos de descanso:</Label>
                              <div className="flex flex-wrap gap-1.5">
                                {empleados.map((emp) => {
                                  const key = `${i}_emp_${emp.nombre}`;
                                  const sel = subRespuestas[key] ?? false;
                                  return (
                                    <button
                                      key={emp.nombre}
                                      type="button"
                                      onClick={() => setSubRespuestas((r) => ({ ...r, [key]: !sel }))}
                                      className={cn(
                                        "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                                        sel
                                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                                          : "border-border bg-background text-foreground hover:bg-muted"
                                      )}
                                    >
                                      {emp.nombre} {sel && "✓"}
                                    </button>
                                  );
                                })}
                              </div>
                              {/* Para cada empleado seleccionado, mostrar selector de día */}
                              {empleados.filter((emp) => subRespuestas[`${i}_emp_${emp.nombre}`]).map((emp) => {
                                const dayKey = `${i}_empdia_${emp.nombre}`;
                                return (
                                  <div key={emp.nombre} className="flex items-center gap-2 pl-2 border-l-2 border-primary/30">
                                    <span className="text-xs font-medium w-24 truncate">{emp.nombre}:</span>
                                    <div className="flex gap-1">
                                      {["L", "M", "X", "J", "V", "S", "D"].map((d, di) => {
                                        const selected = (subRespuestas[`${dayKey}_${di}`] ?? false);
                                        return (
                                          <button
                                            key={d}
                                            type="button"
                                            onClick={() => setSubRespuestas((r) => ({ ...r, [`${dayKey}_${di}`]: !selected }))}
                                            className={cn(
                                              "w-7 h-7 rounded text-[10px] font-bold border transition-all",
                                              selected
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "border-border bg-background text-muted-foreground hover:bg-muted"
                                            )}
                                          >
                                            {d}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Panel para "Configurar días de cierre manualmente" */}
                    {pregLower.includes("cierra algún día completo") && seleccion === "Configurar días de cierre manualmente" && (
                      <div className="mt-2 rounded-lg border border-dashed border-border bg-muted/20 p-3 space-y-1.5 animate-in fade-in-0 slide-in-from-top-1">
                        <Label className="text-xs font-semibold">Selecciona los días que el local cierra:</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((dayName, dayIdx) => {
                            const key = `${i}_cierre_${dayIdx}`;
                            const sel = subRespuestas[key] ?? false;
                            return (
                              <button
                                key={dayName}
                                type="button"
                                onClick={() => setSubRespuestas((r) => ({ ...r, [key]: !sel }))}
                                className={cn(
                                  "px-3 py-1 rounded text-xs font-medium border transition-all",
                                  sel
                                    ? "border-destructive bg-destructive/10 text-destructive shadow-sm"
                                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                                )}
                              >
                                {dayName} {sel && "✓"}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Panel para curva de demanda */}
                    {pregLower.includes("cuánta gente hace falta") && (seleccion.includes("curva de demanda") || seleccion.toLowerCase().includes("otro")) && (
                      <div className="mt-2 rounded-lg border border-dashed border-border bg-muted/20 p-3 space-y-3 animate-in fade-in-0 slide-in-from-top-1">
                        <Label className="text-xs font-semibold">Configura las franjas horarias y la demanda de personal:</Label>
                        
                        <div className="space-y-2">
                          {curvaDemanda.map((franja, fIdx) => (
                            <div key={fIdx} className="flex flex-col gap-2 p-2 border bg-background rounded-md shadow-sm">
                              <div className="flex items-center gap-2">
                                <Input 
                                  type="time" 
                                  className="h-8 w-28 text-xs" 
                                  value={franja.inicio}
                                  onChange={(e) => setCurvaDemanda(prev => {
                                    const copy = [...prev];
                                    copy[fIdx].inicio = e.target.value;
                                    return copy;
                                  })}
                                />
                                <span className="text-muted-foreground text-xs">a</span>
                                <Input 
                                  type="time" 
                                  className="h-8 w-28 text-xs" 
                                  value={franja.fin}
                                  onChange={(e) => setCurvaDemanda(prev => {
                                    const copy = [...prev];
                                    copy[fIdx].fin = e.target.value;
                                    return copy;
                                  })}
                                />
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 ml-auto text-destructive hover:bg-destructive/10"
                                  onClick={() => setCurvaDemanda(prev => prev.filter((_, idx) => idx !== fIdx))}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                              
                              <div className="flex flex-wrap gap-2 items-center">
                                {Object.entries(franja.roles).map(([rolName, count]) => (
                                  <div key={rolName} className="flex items-center gap-1 bg-muted px-2 py-1 rounded border">
                                    <span className="text-xs font-medium">{etiquetaRol(rolName)}:</span>
                                    <Input 
                                      type="number" 
                                      min={1} 
                                      className="h-6 w-14 text-xs p-1" 
                                      value={count}
                                      onChange={(e) => setCurvaDemanda(prev => {
                                        const copy = [...prev];
                                        copy[fIdx].roles[rolName] = Number(e.target.value);
                                        return copy;
                                      })}
                                    />
                                    <button
                                      type="button"
                                      className="text-destructive opacity-70 hover:opacity-100 ml-1"
                                      onClick={() => setCurvaDemanda(prev => {
                                        const copy = [...prev];
                                        delete copy[fIdx].roles[rolName];
                                        return copy;
                                      })}
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                                
                                <Select
                                  value=""
                                  onValueChange={(rol) => {
                                    if (!rol) return;
                                    setCurvaDemanda(prev => {
                                      const copy = [...prev];
                                      if (!copy[fIdx].roles[rol]) {
                                        copy[fIdx].roles[rol] = 1;
                                      }
                                      return copy;
                                    });
                                  }}
                                >
                                  <SelectTrigger className="h-6 text-xs w-[110px] bg-transparent border-dashed">
                                    <SelectValue placeholder="+ Añadir rol" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ROLES_FUNCIONALES.map(r => (
                                      <SelectItem key={r} value={r}>{etiquetaRol(r)}</SelectItem>
                                    ))}
                                    {customRoles.map(cr => (
                                      <SelectItem key={cr} value={cr}>{cr}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          ))}
                        </div>

                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full text-xs h-8 border-dashed"
                          onClick={() => setCurvaDemanda(prev => [
                            ...prev, 
                            { inicio: "00:00", fin: "00:00", roles: {} }
                          ])}
                        >
                          <Plus className="size-3 mr-1" /> Añadir franja horaria
                        </Button>
                      </div>
                    )}

                    {/* Panel genérico para "Configurar manualmente" o "Otro" adaptado al contexto */}
                    {(seleccion.includes("manualmente") || seleccion.toLowerCase().includes("otro")) && !pregLower.includes("cierra algún día completo") && !esHorario && !pregLower.includes("cuánta gente hace falta") && (
                      <div className="mt-2 rounded-lg border border-dashed border-border bg-muted/20 p-4 space-y-4 animate-in fade-in-0 slide-in-from-top-1">
                        
                        {/* Adaptación para preguntas sobre empleados */}
                        {(pregLower.includes("empleado") || pregLower.includes("quién") || pregLower.includes("persona") || pregLower.includes("plantilla") || pregLower.includes("contrato")) && !esAnomalia && (
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-primary">Selecciona los empleados implicados:</Label>
                            <div className="flex flex-wrap gap-1.5">
                              {empleados.map((emp) => {
                                const key = `${i}_emp_${emp.nombre}`;
                                const sel = subRespuestas[key] ?? false;
                                return (
                                  <button
                                    key={emp.nombre}
                                    type="button"
                                    onClick={() => setSubRespuestas((r) => ({ ...r, [key]: !sel }))}
                                    className={cn(
                                      "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                                      sel
                                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                                        : "border-border bg-background text-foreground hover:bg-muted"
                                    )}
                                  >
                                    {emp.nombre} {sel && "✓"}
                                  </button>
                                );
                              })}
                            </div>
                            {empleados.filter(emp => subRespuestas[`${i}_emp_${emp.nombre}`]).length > 0 && (
                              <div className="flex flex-col gap-2 mt-3 p-3 bg-background/50 rounded border border-primary/20">
                                <Label className="text-[10px] uppercase text-muted-foreground font-bold">Especifica el detalle para cada empleado:</Label>
                                {empleados.filter(emp => subRespuestas[`${i}_emp_${emp.nombre}`]).map((emp) => {
                                  const opcionesDetalle = (q.opciones || []).filter(o => !o.toLowerCase().includes("manualmente"));
                                  const tieneOtro = opcionesDetalle.some(o => o.toLowerCase().includes("otro") || o.toLowerCase().includes("especificar"));
                                  if (!tieneOtro) opcionesDetalle.push("Otro (especificar)");

                                  return (
                                    <div key={`detail_${emp.nombre}`} className="flex flex-col gap-2 pl-2 border-l-2 border-primary/30 py-1">
                                      <span className="text-xs font-medium">{emp.nombre}:</span>
                                      <div className="flex flex-wrap gap-1.5">
                                        {opcionesDetalle.map(opc => {
                                          const isSelected = subRespuestas[`${i}_empdetail_${emp.nombre}_btn`] === opc;
                                          return (
                                            <button
                                              key={opc}
                                              type="button"
                                              onClick={() => setSubRespuestas(r => {
                                                const copy = { ...r };
                                                if (isSelected) {
                                                  delete copy[`${i}_empdetail_${emp.nombre}_btn`];
                                                } else {
                                                  copy[`${i}_empdetail_${emp.nombre}_btn`] = opc;
                                                }
                                                return copy;
                                              })}
                                              className={cn(
                                                "px-2 py-1 text-[10px] font-medium rounded border transition-all",
                                                isSelected ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-background text-muted-foreground hover:bg-muted"
                                              )}
                                            >
                                              {opc}
                                            </button>
                                          );
                                        })}
                                      </div>
                                      {subRespuestas[`${i}_empdetail_${emp.nombre}_btn`]?.toString().toLowerCase().includes("otro") && (
                                        <Input 
                                          className="h-7 text-xs bg-background w-full max-w-sm mt-1" 
                                          placeholder="Escribe el detalle exacto para este empleado..."
                                          value={(subRespuestas[`${i}_empdetail_${emp.nombre}_txt`] as string) || ""}
                                          onChange={(e) => setSubRespuestas((r) => ({ ...r, [`${i}_empdetail_${emp.nombre}_txt`]: e.target.value }))}
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Adaptación para preguntas sobre roles */}
                        {(pregLower.includes("rol") || pregLower.includes("cocinero") || pregLower.includes("camarero") || pregLower.includes("puesto")) && (
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-accent">Selecciona los roles afectados:</Label>
                            <div className="flex flex-wrap gap-1.5">
                              {ROLES_FUNCIONALES.map((rol) => {
                                const key = `${i}_rol_${rol}`;
                                const sel = subRespuestas[key] ?? false;
                                return (
                                  <button
                                    key={rol}
                                    type="button"
                                    onClick={() => setSubRespuestas((r) => ({ ...r, [key]: !sel }))}
                                    className={cn(
                                      "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                                      sel
                                        ? "border-accent bg-accent/10 text-accent shadow-sm"
                                        : "border-border bg-background text-foreground hover:bg-muted"
                                    )}
                                  >
                                    {etiquetaRol(rol)} {sel && "✓"}
                                  </button>
                                );
                              })}
                            </div>
                            {ROLES_FUNCIONALES.filter(rol => subRespuestas[`${i}_rol_${rol}`]).length > 0 && (
                              <div className="flex flex-col gap-2 mt-3 p-3 bg-background/50 rounded border border-accent/20">
                                <Label className="text-[10px] uppercase text-muted-foreground font-bold">Especifica el detalle para cada rol:</Label>
                                {ROLES_FUNCIONALES.filter(rol => subRespuestas[`${i}_rol_${rol}`]).map((rol) => {
                                  const opcionesDetalle = (q.opciones || []).filter(o => !o.toLowerCase().includes("manualmente"));
                                  const tieneOtro = opcionesDetalle.some(o => o.toLowerCase().includes("otro") || o.toLowerCase().includes("especificar"));
                                  if (!tieneOtro) opcionesDetalle.push("Otro (especificar)");

                                  return (
                                    <div key={`detail_${rol}`} className="flex flex-col gap-2 pl-2 border-l-2 border-accent/30 py-1">
                                      <span className="text-xs font-medium">{etiquetaRol(rol)}:</span>
                                      <div className="flex flex-wrap gap-1.5">
                                        {opcionesDetalle.map(opc => {
                                          const isSelected = subRespuestas[`${i}_roldetail_${rol}_btn`] === opc;
                                          return (
                                            <button
                                              key={opc}
                                              type="button"
                                              onClick={() => setSubRespuestas(r => {
                                                const copy = { ...r };
                                                if (isSelected) {
                                                  delete copy[`${i}_roldetail_${rol}_btn`];
                                                } else {
                                                  copy[`${i}_roldetail_${rol}_btn`] = opc;
                                                }
                                                return copy;
                                              })}
                                              className={cn(
                                                "px-2 py-1 text-[10px] font-medium rounded border transition-all",
                                                isSelected ? "bg-accent text-accent-foreground border-accent shadow-sm" : "bg-background text-muted-foreground hover:bg-muted"
                                              )}
                                            >
                                              {opc}
                                            </button>
                                          );
                                        })}
                                      </div>
                                      {subRespuestas[`${i}_roldetail_${rol}_btn`]?.toString().toLowerCase().includes("otro") && (
                                        <Input 
                                          className="h-7 text-xs bg-background w-full max-w-sm mt-1" 
                                          placeholder="Escribe el detalle exacto para este rol..."
                                          value={(subRespuestas[`${i}_roldetail_${rol}_txt`] as string) || ""}
                                          onChange={(e) => setSubRespuestas((r) => ({ ...r, [`${i}_roldetail_${rol}_txt`]: e.target.value }))}
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Detalla la situación (se pasará al sistema):</Label>
                          <textarea
                            className="w-full h-20 px-3 py-2 text-sm border rounded bg-background resize-none focus:ring-1 focus:ring-primary outline-none"
                            placeholder="Escribe aquí tu configuración manual o los detalles..."
                            value={(subRespuestas[`${i}_manual_txt`] as string) || ""}
                            onChange={(e) => setSubRespuestas((r) => ({ ...r, [`${i}_manual_txt`]: e.target.value }))}
                          />
                        </div>
                      </div>
                    )}

                    {/* Panel para "El horario es diferente" */}
                    {esHorario && seleccion === "Es diferente (configurar manualmente)" && (
                      <div className="mt-2 flex flex-col gap-4 rounded-lg border border-dashed border-border bg-muted/20 p-4 w-full animate-in fade-in-0 slide-in-from-top-1">
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex flex-col gap-1.5">
                            <Label className="text-xs font-semibold">Horario de apertura</Label>
                            <Input
                              type="time"
                              className="h-8 w-32"
                              value={form.aperturaSemana}
                              onChange={(ev) => {
                                const val = ev.target.value;
                                setForm((prev) => ({ ...prev, aperturaSemana: val }));
                              }}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label className="text-xs font-semibold">Horario de cierre</Label>
                            <Input
                              type="time"
                              className="h-8 w-32"
                              value={form.cierreSemana}
                              onChange={(ev) => {
                                const val = ev.target.value;
                                setForm((prev) => ({ ...prev, cierreSemana: val }));
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Panel para "Días fuertes son otros" */}
                    {pregLower.includes("días con más empleados") && seleccion === "Configurar los días fuertes manualmente" && (
                      <div className="mt-2 rounded-lg border border-dashed border-border bg-muted/20 p-3 space-y-1.5 animate-in fade-in-0 slide-in-from-top-1">
                        <Label className="text-xs font-semibold">Selecciona los días fuertes:</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((dayName, dayIdx) => {
                            const key = `${i}_dia_${dayIdx}`;
                            const sel = subRespuestas[key] ?? false;
                            return (
                              <button
                                key={dayName}
                                type="button"
                                onClick={() => setSubRespuestas((r) => ({ ...r, [key]: !sel }))}
                                className={cn(
                                  "px-3 py-1 rounded text-xs font-medium border transition-all",
                                  sel
                                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                                )}
                              >
                                {dayName} {sel && "★"}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Panel para "Sí, algunos tienen días fijos" */}
                    {pregLower.includes("días de descanso fijos") && seleccion.toLowerCase().includes("algunos") && (
                      <div className="mt-2 rounded-lg border border-dashed border-border bg-muted/20 p-3 space-y-2 animate-in fade-in-0 slide-in-from-top-1">
                        <Label className="text-xs font-semibold">Selecciona empleados con días fijos:</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {empleados.map((emp) => {
                            const key = `${i}_emp_${emp.nombre}`;
                            const sel = subRespuestas[key] ?? false;
                            return (
                              <button
                                key={emp.nombre}
                                type="button"
                                onClick={() => setSubRespuestas((r) => ({ ...r, [key]: !sel }))}
                                className={cn(
                                  "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                                  sel
                                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                                    : "border-border bg-background text-foreground hover:bg-muted"
                                )}
                              >
                                {emp.nombre} {sel && "✓"}
                              </button>
                            );
                          })}
                        </div>
                        {empleados.filter((emp) => subRespuestas[`${i}_emp_${emp.nombre}`]).map((emp) => {
                          const dayKey = `${i}_empdia_${emp.nombre}`;
                          return (
                            <div key={emp.nombre} className="flex items-center gap-2 pl-2 border-l-2 border-primary/30">
                              <span className="text-xs font-medium w-24 truncate">{emp.nombre}:</span>
                              <div className="flex gap-1">
                                {["L", "M", "X", "J", "V", "S", "D"].map((d, di) => {
                                  const selected = (subRespuestas[`${dayKey}_${di}`] ?? false);
                                  return (
                                    <button
                                      key={d}
                                      type="button"
                                      onClick={() => setSubRespuestas((r) => ({ ...r, [`${dayKey}_${di}`]: !selected }))}
                                      className={cn(
                                        "w-7 h-7 rounded text-[10px] font-bold border transition-all",
                                        selected
                                          ? "border-primary bg-primary text-primary-foreground"
                                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                                      )}
                                    >
                                      {d}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Panel para "Algunos son polivalentes" */}
                    {pregLower.includes("cubrir un rol") && seleccion.toLowerCase().includes("algunos") && (
                      <div className="mt-2 rounded-lg border border-dashed border-border bg-muted/20 p-3 space-y-2 animate-in fade-in-0 slide-in-from-top-1">
                        <Label className="text-xs font-semibold">¿Qué empleados son polivalentes?</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {empleados.map((emp) => {
                            const key = `${i}_emp_${emp.nombre}`;
                            const sel = subRespuestas[key] ?? false;
                            return (
                              <button
                                key={emp.nombre}
                                type="button"
                                onClick={() => setSubRespuestas((r) => ({ ...r, [key]: !sel }))}
                                className={cn(
                                  "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                                  sel
                                    ? "border-accent bg-accent/10 text-accent shadow-sm"
                                    : "border-border bg-background text-foreground hover:bg-muted"
                                )}
                              >
                                {emp.nombre} ({emp.rol}) {sel && "✓"}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Panel para "Algunos tienen el finde fijo libre" */}
                    {pregLower.includes("fines de semana") && seleccion.toLowerCase().includes("algunos") && (
                      <div className="mt-2 rounded-lg border border-dashed border-border bg-muted/20 p-3 space-y-2 animate-in fade-in-0 slide-in-from-top-1">
                        <Label className="text-xs font-semibold">¿Qué empleados tienen el fin de semana fijo libre?</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {empleados.map((emp) => {
                            const key = `${i}_emp_${emp.nombre}`;
                            const sel = subRespuestas[key] ?? false;
                            return (
                              <button
                                key={emp.nombre}
                                type="button"
                                onClick={() => setSubRespuestas((r) => ({ ...r, [key]: !sel }))}
                                className={cn(
                                  "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                                  sel
                                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                                    : "border-border bg-background text-foreground hover:bg-muted"
                                )}
                              >
                                {emp.nombre} {sel && "✓"}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
          <div className="flex justify-end mt-4">
    <Button onClick={guardarRespuestasNuevas} disabled={guardando}>
      {guardando ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
      Guardar Configuración Inicial
    </Button>
  </div>
        </div>
          </CardContent>
        </Card>
      ) : Object.keys(ajustes.respuestasOnboarding || {}).length > 0 ? (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Sparkles className="size-5" /> Cuadrante insertado y calibrado correctamente
            </CardTitle>
            <CardDescription className="text-green-700/80 dark:text-green-400/80">
              El sistema ha guardado la configuración inicial de tu local basada en tus respuestas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              {Object.entries(ajustes.respuestasOnboarding).filter(([k]) => !k.includes("_")).map(([qIdx, ans]) => (
                <div key={qIdx} className="flex flex-col gap-1 rounded-md border border-green-500/20 bg-background/60 p-3 shadow-sm">
                  <span className="font-semibold text-foreground/80">Pregunta {Number(qIdx) + 1}</span>
                  <span className="font-medium text-foreground">{ans as string}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

{/* 1. Horarios de apertura y cierre */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5 text-primary" /> Horarios de la Ubicación
          </CardTitle>
          <CardDescription>
            Configura el horario operativo del establecimiento. El sistema evitará asignar turnos fuera de este rango.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Apertura (Lunes a Viernes)</Label>
              <Input
                type="time"
                value={form.aperturaSemana}
                onChange={(e) => setForm({ ...form, aperturaSemana: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cierre (Lunes a Viernes)</Label>
              <Input
                type="time"
                value={form.cierreSemana}
                onChange={(e) => setForm({ ...form, cierreSemana: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-md border border-border p-3 bg-muted/20">
            <Switch
              id="calib-dif-fin-semana"
              checked={form.diferenteFinSemana}
              onCheckedChange={(val) => setForm({ ...form, diferenteFinSemana: val })}
            />
            <Label htmlFor="calib-dif-fin-semana" className="text-sm font-semibold cursor-pointer">
              ¿Tiene horario diferente el fin de semana (Sábado y Domingo)?
            </Label>
          </div>

          {form.diferenteFinSemana && (
            <div className="grid gap-4 sm:grid-cols-2 p-3 rounded-lg border border-dashed border-border bg-muted/10">
              <div className="space-y-1.5">
                <Label>Apertura Fin de Semana</Label>
                <Input
                  type="time"
                  value={form.aperturaFinSemana}
                  onChange={(e) => setForm({ ...form, aperturaFinSemana: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cierre Fin de Semana</Label>
                <Input
                  type="time"
                  value={form.cierreFinSemana}
                  onChange={(e) => setForm({ ...form, cierreFinSemana: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="space-y-2 border-t border-border/40 pt-4">
            <Label className="text-sm font-semibold">¿Cierra algún día de la semana?</Label>
            <div className="flex flex-wrap gap-1.5">
              {DIAS_NOMBRES.map((dayName, dayIdx) => {
                const isClosed = form.diasCierre.includes(dayIdx);
                return (
                  <button
                    key={dayName}
                    type="button"
                    onClick={() => toggleDiaCierre(dayIdx)}
                    className={cn(
                      "px-3 py-1.5 rounded text-xs font-medium border transition-all",
                      isClosed
                        ? "border-destructive bg-destructive/10 text-destructive shadow-sm font-semibold"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {dayName} {isClosed && "(Cerrado)"}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Turnos Partidos por Rol */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5 text-primary" /> Calibración de Turnos Partidos
          </CardTitle>
          <CardDescription>
            Indica qué puestos de trabajo tienen permitido realizar turnos partidos (doble turno diario).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {ROLES_FUNCIONALES.map((rol) => {
              const allowed = rolesPartido.includes(rol);
              return (
                <div
                  key={rol}
                  onClick={() => toggleRolPartido(rol)}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border cursor-pointer select-none transition-all",
                    allowed
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-background hover:bg-muted/30 text-muted-foreground"
                  )}
                >
                  <span className="text-sm font-medium text-foreground">{etiquetaRol(rol)}</span>
                  <Switch checked={allowed} onCheckedChange={() => {}} />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Botón principal de guardado de la calibración del local */}
      <div className="flex justify-end">
        <Button onClick={guardar} disabled={guardando} size="lg">
          {guardando ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
          Guardar Calibración Horaria
        </Button>
      </div>

      {/* 3. Restricciones del Personal */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarRange className="size-5 text-primary" /> Restricciones e Disponibilidades de Empleados
            </CardTitle>
            <CardDescription>
              Gestiona los días de descanso y franjas prohibidas por empleado para la planificación automática.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2.5 px-3">Empleado</th>
                  <th className="py-2.5 px-3">Rol</th>
                  <th className="py-2.5 px-3">Contrato</th>
                  <th className="py-2.5 px-3">Horas/Sem</th>
                  <th className="py-2.5 px-3 text-center">Días Descanso</th>
                  <th className="py-2.5 px-3">Pref. Turno</th>
                  <th className="py-2.5 px-3 text-center">Partido</th>
                  <th className="py-2.5 px-3 text-center">Extra</th>
                  <th className="py-2.5 px-3">Restricciones Horarias</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {empleados.map((emp) => {
                  const empDisps = disponibilidades.filter((d) => d.empleadoId === emp.id);
                  const draft = getDraft(emp);
                  const dirty = isDirty(emp);
                  const guardandoEmp = cargandoAccion === `save-emp-${emp.id}`;

                  return (
                    <tr key={emp.id} className={cn("hover:bg-muted/10", dirty && "bg-warning-soft/10")}>
                      {/* 1. Nombre */}
                      <td className="py-2 px-3 font-medium min-w-[160px]">
                        <Input
                          className="h-8 text-sm"
                          value={draft.nombreCompleto}
                          onChange={(ev) => updateDraft(emp.id, { nombreCompleto: ev.target.value })}
                        />
                      </td>
                      {/* 2. Rol */}
                      <td className="py-2 px-3 min-w-[180px]">
                        <div className="flex items-center gap-1.5">
                          <Select
                            value={draft.rol}
                            onValueChange={(val) => updateDraft(emp.id, { rol: val })}
                          >
                            <SelectTrigger className="h-8 w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {!(ROLES_FUNCIONALES as readonly string[]).includes(draft.rol) && draft.rol && !customRoles.includes(draft.rol) && (
                                <SelectItem value={draft.rol}>{draft.rol}</SelectItem>
                              )}
                              {ROLES_FUNCIONALES.map((r) => (
                                <SelectItem key={r} value={r}>{etiquetaRol(r)}</SelectItem>
                              ))}
                              {customRoles.map((cr) => (
                                <SelectItem key={cr} value={cr}>{cr}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={() => {
                              const nuevoRol = prompt("Introduce el nombre del nuevo rol:");
                              if (nuevoRol && nuevoRol.trim()) {
                                const rolNormalizado = nuevoRol.trim();
                                if (!customRoles.includes(rolNormalizado)) {
                                  setCustomRoles((prev) => [...prev, rolNormalizado]);
                                }
                                updateDraft(emp.id, { rol: rolNormalizado });
                              }
                            }}
                          >
                            + Rol
                          </Button>
                        </div>
                      </td>
                      {/* 3. Contrato */}
                      <td className="py-2 px-3 min-w-[120px]">
                        <Select
                          value={draft.tipoContrato}
                          onValueChange={(val) => updateDraft(emp.id, { tipoContrato: val })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="COMPLETO">Completo</SelectItem>
                            <SelectItem value="PARCIAL">Parcial</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      {/* 4. Horas */}
                      <td className="py-2 px-3 min-w-[80px] w-20">
                        <Input
                          type="number"
                          className="h-8"
                          value={draft.horasSemana}
                          onChange={(ev) => updateDraft(emp.id, { horasSemana: Number(ev.target.value) })}
                        />
                      </td>
                      {/* 5. Días de Descanso */}
                      <td className="py-2 px-3 min-w-[100px] w-24 text-center">
                        <Select
                          value={String(draft.diasDescanso)}
                          onValueChange={(val) => updateDraft(emp.id, { diasDescanso: Number(val) })}
                        >
                          <SelectTrigger className="h-8 mx-auto w-16">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[0, 1, 2, 3, 4, 5, 6].map((num) => (
                              <SelectItem key={num} value={String(num)}>
                                {num}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      {/* 6. Preferencia Turno */}
                      <td className="py-2 px-3 min-w-[120px]">
                        <Select
                          value={draft.preferenciaTurno}
                          onValueChange={(val) => updateDraft(emp.id, { preferenciaTurno: val })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="INDIFERENTE">Indiferente</SelectItem>
                            <SelectItem value="MAÑANA">Mañana</SelectItem>
                            <SelectItem value="TARDE">Tarde</SelectItem>
                            <SelectItem value="NOCHE">Noche</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      {/* 7. Turno Partido */}
                      <td className="py-2 px-3 min-w-[70px] text-center">
                        <Switch
                          checked={draft.permitePartido}
                          onCheckedChange={(val) => updateDraft(emp.id, { permitePartido: val })}
                        />
                      </td>
                      {/* 8. Horas Extras */}
                      <td className="py-2 px-3 min-w-[70px] text-center">
                        <Switch
                          checked={draft.admiteHorasExtra}
                          onCheckedChange={(val) => updateDraft(emp.id, { admiteHorasExtra: val })}
                        />
                      </td>

                      {/* 10. Restricciones */}
                      <td className="py-2 px-3 min-w-[220px]">
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {empDisps.length === 0 ? (
                            <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                              <Info className="size-3" /> Totalmente disponible
                            </span>
                          ) : (
                            empDisps.map((d) => {
                              const delLoading = cargandoAccion === `del-${d.id}`;
                              const actLoading = cargandoAccion === `act-${d.id}`;
                              const diaLabel = d.diaSemana !== null ? DIAS_NOMBRES[d.diaSemana] : "";
                              const franjaLabel = d.franjaInicio !== "00:00" || d.franjaFin !== "23:59"
                                ? `(${d.franjaInicio}–${d.franjaFin})`
                                : "";
                              const prefText = d.estado === "PREFIERE_NO" ? "Prefiere no" : "No disponible";

                              return (
                                <Badge
                                  key={d.id}
                                  variant={d.activa ? (d.estado === "PREFIERE_NO" ? "warning" : "danger") : "neutral"}
                                  className={cn("flex items-center gap-1.5 py-0.5 px-2 transition-all", !d.activa && "opacity-50")}
                                >
                                  <input
                                    type="checkbox"
                                    checked={d.activa}
                                    onChange={(ev) => cambiarActivaDisponibilidad(d.id, ev.target.checked)}
                                    disabled={actLoading}
                                    className="h-3 w-3 cursor-pointer rounded border-gray-300 text-primary focus:ring-primary bg-background"
                                    title={d.activa ? "Desactivar restricción" : "Activar restricción"}
                                  />
                                  <span className={cn("text-[10px] select-none", !d.activa && "line-through")}>
                                    {diaLabel} {franjaLabel} · {prefText.toLowerCase()}
                                  </span>
                                  <button
                                    onClick={() => borrarRestriccion(d.id)}
                                    disabled={delLoading}
                                    className="ml-1 hover:text-white/80 transition-colors"
                                  >
                                    {delLoading ? (
                                      <Loader2 className="size-2.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="size-2.5" />
                                    )}
                                  </button>
                                </Badge>
                              );
                            })
                          )}
                        </div>
                      </td>
                      {/* 11. Acciones */}
                      <td className="py-2 px-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          {dirty && (
                            <Button
                              variant="accent"
                              size="sm"
                              className="h-8 text-xs flex items-center gap-1"
                              disabled={guardandoEmp}
                              onClick={() => guardarEmpleado(emp.id)}
                            >
                              {guardandoEmp ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                              Guardar
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs flex items-center gap-1"
                            onClick={() => {
                              setNuevaDisp({
                                empleadoId: emp.id,
                                diaSemana: "0",
                                estado: "NO_DISPONIBLE",
                                franjaInicio: "00:00",
                                franjaFin: "23:59",
                                notas: "",
                              });
                              setNuevaDispOpen(true);
                            }}
                          >
                            <Plus className="size-3" /> Restricción
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal: Añadir disponibilidad/restricción */}
      <Dialog open={nuevaDispOpen} onOpenChange={setNuevaDispOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Restricción de Horario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label>Día de la Semana</Label>
              <Select
                value={nuevaDisp.diaSemana}
                onValueChange={(val) => setNuevaDisp({ ...nuevaDisp, diaSemana: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIAS_NOMBRES.map((name, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Preferencia / Disponibilidad</Label>
              <Select
                value={nuevaDisp.estado}
                onValueChange={(val) => setNuevaDisp({ ...nuevaDisp, estado: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NO_DISPONIBLE">No disponible (Descanso obligado)</SelectItem>
                  <SelectItem value="PREFIERE_NO">Prefiere no trabajar (Opcional)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Hora Inicio</Label>
                <Input
                  type="time"
                  value={nuevaDisp.franjaInicio}
                  onChange={(e) => setNuevaDisp({ ...nuevaDisp, franjaInicio: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Hora Fin</Label>
                <Input
                  type="time"
                  value={nuevaDisp.franjaFin}
                  onChange={(e) => setNuevaDisp({ ...nuevaDisp, franjaFin: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notas (Opcional)</Label>
              <Input
                value={nuevaDisp.notas}
                onChange={(e) => setNuevaDisp({ ...nuevaDisp, notas: e.target.value })}
                placeholder="Ej. cita médica, universidad..."
              />
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNuevaDispOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={crearRestriccion} disabled={cargandoAccion === "add-disp"}>
              {cargandoAccion === "add-disp" && <Loader2 className="mr-2 size-4 animate-spin" />}
              Guardar Restricción
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
