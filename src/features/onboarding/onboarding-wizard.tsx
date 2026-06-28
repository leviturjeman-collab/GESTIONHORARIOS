"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Upload,
  Loader2,
  Sparkles,
  Check,
  Download,
  ArrowRight,
  ArrowLeft,
  FileSpreadsheet,
  Trash2,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ROLES_FUNCIONALES, etiquetaRol } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { analizarArchivo, confirmarOnboarding } from "@/features/onboarding/actions";
import type { EmpleadoDetectado, ResultadoAnalisis } from "@/lib/ai/onboarding";

const PASOS = ["Subir", "Analizar", "Revisar", "Confirmar"];

export function OnboardingWizard() {
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cargando, setCargando] = useState(false);
  const [progreso, setProgreso] = useState("");
  const [analisis, setAnalisis] = useState<ResultadoAnalisis | null>(null);
  const [empleados, setEmpleados] = useState<EmpleadoDetectado[]>([]);
  const [respuestas, setRespuestas] = useState<Record<number, string>>({});
  const [subRespuestas, setSubRespuestas] = useState<Record<string, boolean | string>>({});
  const [detallesRestricciones, setDetallesRestricciones] = useState<Record<string, { tipo: "dia" | "turno" | "otro"; dia?: number; turno?: string; notas?: string }>>({});
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const [curvaDemanda, setCurvaDemanda] = useState<{ inicio: string, fin: string, roles: Record<string, number> }[]>([
    { inicio: "11:00", fin: "13:00", roles: { cocinero: 1, camarero: 1 } },
    { inicio: "13:00", fin: "14:00", roles: { cocinero: 2, camarero: 2 } },
    { inicio: "14:00", fin: "17:00", roles: { cocinero: 3, camarero: 4 } },
  ]);
  const [horarioCustom, setHorarioCustom] = useState({
    aperturaSemana: "09:00",
    cierreSemana: "23:00",
    diferenteFinSemana: false,
    aperturaFinSemana: "09:00",
    cierreFinSemana: "23:00",
    diasCierre: [] as number[],
  });
  const [ubic, setUbic] = useState({
    nombre: "",
    direccion: "",
    horaApertura: "09:00",
    horaCierre: "23:00",
    generarCuadrante: true,
  });

  async function analizar() {
    if (!archivo) return toast.error("Selecciona un archivo");
    setCargando(true);
    setPaso(1);

    // Detectar tipo para mostrar progreso adecuado
    const esImg = archivo.type?.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(archivo.name);
    if (esImg) {
      setProgreso("Leyendo texto de la imagen (OCR)...");
    } else if (archivo.type === "application/pdf" || /\.pdf$/i.test(archivo.name)) {
      setProgreso("Extrayendo texto del PDF...");
    } else {
      setProgreso("Procesando el archivo...");
    }

    // Timeout de seguridad: 3 minutos máximo
    const timeout = setTimeout(() => {
      setCargando(false);
      setProgreso("");
      toast.error("El análisis ha tardado demasiado. Prueba con un archivo más pequeño o en otro formato.");
      setPaso(0);
    }, 180_000);

    try {
      // Actualizar progreso después de unos segundos (la fase OCR suele durar ~5-40s)
      const progresoTimer = esImg
        ? setTimeout(() => setProgreso("Procesamiento completado. El sistema está analizando los datos..."), 45_000)
        : setTimeout(() => setProgreso("El sistema está analizando los datos..."), 5_000);

      const fd = new FormData();
      fd.append("archivo", archivo);
      console.log("[analizar] Enviando archivo al servidor...");
      const res = await analizarArchivo(fd);
      console.log("[analizar] Respuesta recibida:", JSON.stringify({ ok: res.ok, error: !res.ok ? (res as any).error : undefined, empleados: res.ok && res.data ? res.data.empleados?.length : 0 }));

      clearTimeout(timeout);
      clearTimeout(progresoTimer);
      setCargando(false);
      setProgreso("");

      if (res.ok && res.data) {
        console.log("[analizar] Éxito:", res.data.empleados.length, "empleados");
        setAnalisis(res.data);
        setEmpleados(res.data.empleados);

        // Auto-detectar roles nuevos que no están en ROLES_FUNCIONALES
        const rolesExternos = [
          ...new Set(
            res.data.empleados
              .map((e) => e.rol)
              .filter(
                (r): r is string =>
                  !!r &&
                  r !== "sin_rol" &&
                  !(ROLES_FUNCIONALES as readonly string[]).includes(r)
              )
          ),
        ];
        if (rolesExternos.length > 0) {
          setCustomRoles((prev) => [
            ...prev,
            ...rolesExternos.filter((r) => !prev.includes(r)),
          ]);
        }

        setPaso(2);
        router.refresh();
      } else {
        console.log("[analizar] Error:", !res.ok ? (res as any).error : "Sin datos");
        toast.error(res.ok ? "Sin datos" : (res as any).error);
        setPaso(0);
      }
    } catch (err) {
      clearTimeout(timeout);
      console.error("Error en análisis:", err);
      setCargando(false);
      setProgreso("");
      toast.error("Error al analizar el archivo. Inténtalo de nuevo.");
      setPaso(0);
    }
  }

  function editar(i: number, campo: keyof EmpleadoDetectado, valor: any) {
    setEmpleados((arr) =>
      arr.map((e, idx) => (idx === i ? { ...e, [campo]: valor } : e))
    );
  }

  async function confirmar() {
    if (!ubic.nombre.trim()) return toast.error("Pon un nombre a la ubicación");
    setCargando(true);
    try {
      const empleadosConRestricciones: string[] = [];
      const rolesTurnoPartido: string[] = [];
      const restriccionesDetalles: Record<string, { tipo: "dia" | "turno" | "otro"; dia?: number; turno?: string; notas?: string }> = {};

      Object.entries(subRespuestas).forEach(([key, val]) => {
        if (!val) return;
        if (key.includes("_emp_")) {
          const parts = key.split("_emp_");
          const empName = parts[1];
          if (empName) {
            empleadosConRestricciones.push(empName);
            if (detallesRestricciones[key]) {
              restriccionesDetalles[empName] = detallesRestricciones[key];
            }
          }
        } else if (key.includes("_rol_")) {
          const parts = key.split("_rol_");
          if (parts[1]) rolesTurnoPartido.push(parts[1]);
        }
      });

      const respuestasParaServer: Record<string, string> = {};
      Object.entries(respuestas).forEach(([qIdx, optionIdx]) => {
        const numQ = Number(qIdx);
        const q = analisis?.preguntas?.[numQ];
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

      const res = await confirmarOnboarding({
        nombreUbicacion: ubic.nombre,
        direccion: ubic.direccion,
        horaApertura: ubic.horaApertura,
        horaCierre: ubic.horaCierre,
        empleados,
        generarCuadrante: ubic.generarCuadrante,
        empleadosConRestricciones,
        rolesTurnoPartido,
        respuestas: respuestasParaServer,
        restriccionesDetalles,
        horarioCustom,
        preguntas: analisis?.preguntas ?? [],
      });
      setCargando(false);
      if (res.ok) {
        toast.success("Ubicación creada con su equipo");
        router.push("/empleados");
        router.refresh();
      } else toast.error(res.error);
    } catch (err) {
      console.error("Error al confirmar:", err);
      setCargando(false);
      toast.error("Error al crear la ubicación. Inténtalo de nuevo.");
    }
  }

  function descargarEjemplo() {
    const csv =
      "Nombre,Tipo,Horas semana,Horas extra,Dias descanso,Rol\n" +
      "Ana López,Completo,40,2,2,Camarero\n" +
      "Mario Ruiz,Parcial,20,0,3,Cocina\n" +
      "Lucía Paz,Completo,40,0,2,Barra\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ejemplo-empleados.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Barra de progreso */}
      <ol className="flex flex-wrap items-center gap-2">
        {PASOS.map((p, i) => (
          <li key={p} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
                i < paso
                  ? "bg-success text-success-foreground"
                  : i === paso
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {i < paso ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={cn("text-sm", i === paso ? "font-medium" : "text-muted-foreground")}>
              {p}
            </span>
            {i < PASOS.length - 1 && <span className="mx-1 h-px w-6 bg-border" />}
          </li>
        ))}
      </ol>

      {/* Paso 1: subir */}
      {paso === 0 && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-12 text-center transition hover:border-primary">
              <Upload className="mb-3 size-8 text-muted-foreground" />
              <span className="text-sm font-medium">
                {archivo ? archivo.name : "Arrastra tu Excel, CSV, PDF o una foto/captura del cuadrante"}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                o haz clic para seleccionarlo · .xlsx · .csv · .pdf · .png · .jpg
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.pdf,application/pdf,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              />
            </label>
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => router.push("/inicio")}>
                  <ArrowLeft className="size-4" /> Volver al inicio
                </Button>
                <Button variant="ghost" size="sm" onClick={descargarEjemplo}>
                  <Download /> Descargar formato de ejemplo
                </Button>
              </div>
              <Button onClick={analizar} disabled={!archivo}>
                <Sparkles /> Analizar Archivo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paso 2: analizando */}
      {paso === 1 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="mb-4 size-8 animate-spin text-primary" />
            <p className="font-medium">El sistema está analizando tu archivo.</p>
            <p className="text-sm text-muted-foreground mb-2">
              {progreso || "Detectando empleados, contratos, horas y roles."}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Esto puede tardar hasta 2 minutos. No cierres la página.
            </p>
            <Button variant="outline" size="sm" onClick={() => setPaso(0)}>
              <ArrowLeft className="size-4" /> Cancelar y volver
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Paso 3: revisar tabla editable */}
      {paso === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant={analisis?.modo === "ia" ? "default" : "warning"}>
              {analisis?.modo === "ia" ? "Análisis completado" : "Modo simulado (sin clave)"}
            </Badge>
            <p className="text-sm text-muted-foreground">
              {empleados.length} empleados detectados. Corrige lo que haga falta — las
              celdas en ámbar conviene revisarlas.
            </p>
          </div>
          <Card>
            <CardContent className="overflow-x-auto pt-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="px-2 py-2">Nombre</th>
                    <th className="px-2 py-2">Contrato</th>
                    <th className="px-2 py-2">Horas</th>
                    <th className="px-2 py-2">Extra</th>
                    <th className="px-2 py-2">Descanso</th>
                    <th className="px-2 py-2">Rol</th>
                    <th className="px-2 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {empleados.map((e, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-2 py-1.5">
                        <Input
                          className={cn("h-8", e.confianza.nombre === "media" && "border-warning")}
                          value={e.nombre}
                          onChange={(ev) => editar(i, "nombre", ev.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Select value={e.tipo} onValueChange={(v) => editar(i, "tipo", v)}>
                          <SelectTrigger className={cn("h-8 w-28", e.confianza.tipo === "media" && "border-warning")}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="COMPLETO">Completo</SelectItem>
                            <SelectItem value="PARCIAL">Parcial</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          className={cn("h-8 w-20", e.confianza.horasSemana === "media" && "border-warning")}
                          value={e.horasSemana}
                          onChange={(ev) => editar(i, "horasSemana", Number(ev.target.value))}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          className="h-8 w-16"
                          value={e.horasExtra}
                          onChange={(ev) => editar(i, "horasExtra", Number(ev.target.value))}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          className={cn("h-8 w-16", e.confianza.diasDescanso === "media" && "border-warning")}
                          value={e.diasDescanso}
                          onChange={(ev) => editar(i, "diasDescanso", Number(ev.target.value))}
                        />
                      </td>
                      <td className="px-2 py-1.5 flex items-center gap-1.5">
                        <Select value={e.rol} onValueChange={(v) => editar(i, "rol", v)}>
                          <SelectTrigger className={cn("h-8 w-40", e.confianza.rol === "media" && "border-warning")}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {/* Si el rol actual no está en la lista ni en customRoles, mostrarlo primero */}
                            {!(ROLES_FUNCIONALES as readonly string[]).includes(e.rol) && e.rol && !customRoles.includes(e.rol) && (
                              <SelectItem value={e.rol}>{e.rol}</SelectItem>
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
                              editar(i, "rol", rolNormalizado);
                            }
                          }}
                        >
                          Añadir rol
                        </Button>
                      </td>
                      <td className="px-2 py-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => setEmpleados((prev) => prev.filter((_, idx) => idx !== i))}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setPaso(0)}>
              <ArrowLeft /> Volver
            </Button>
            <Button onClick={() => setPaso(3)}>
              Continuar <ArrowRight />
            </Button>
          </div>
        </div>
      )}

      {/* Paso 4: confirmar */}
      {paso === 3 && (
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="size-4" /> {empleados.length} empleados listos
                para crear.
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nombre de la ubicación</Label>
                  <Input
                    value={ubic.nombre}
                    onChange={(e) => setUbic({ ...ubic, nombre: e.target.value })}
                    placeholder="Restaurante Centro"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Dirección</Label>
                  <Input
                    value={ubic.direccion}
                    onChange={(e) => setUbic({ ...ubic, direccion: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Hora de apertura</Label>
                  <Input
                    value={ubic.horaApertura}
                    onChange={(e) => setUbic({ ...ubic, horaApertura: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Hora de cierre</Label>
                  <Input
                    value={ubic.horaCierre}
                    onChange={(e) => setUbic({ ...ubic, horaCierre: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={ubic.generarCuadrante}
                  onChange={(e) => setUbic({ ...ubic, generarCuadrante: e.target.checked })}
                />
                Crear también el cuadrante de esta semana (borrador)
              </label>
            </CardContent>
          </Card>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setPaso(2)}>
              <ArrowLeft /> Volver
            </Button>
            <Button onClick={confirmar} disabled={cargando}>
              {cargando ? <Loader2 className="animate-spin" /> : <Check />}
              Crear ubicación y equipo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
