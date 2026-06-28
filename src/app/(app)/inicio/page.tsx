import Link from "next/link";
import { Euro, Clock, AlarmClock, Plane, Sparkles, ArrowRight } from "lucide-react";
import { requireSesion, resolverAmbito } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { lunesDeSemana, rangoSemanaTexto } from "@/lib/fechas";
import { resumenTurnos, horasExtra, type TurnoConEmpleado } from "@/lib/metricas";
import { euros, horas } from "@/lib/utils";
import { etiquetaRol } from "@/lib/enums";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";

export default async function InicioPage({
  searchParams,
}: {
  searchParams: { ubicacion?: string };
}) {
  const usuario = await requireSesion();
  const ambito = await resolverAmbito(usuario, searchParams.ubicacion);
  const lunes = lunesDeSemana();

  const cuadrantes = await prisma.cuadrante.findMany({
    where: { ubicacionId: { in: ambito }, semanaInicio: lunes },
    include: {
      ubicacion: { select: { nombre: true } },
      turnos: { include: { empleado: { include: { contrato: true } } } },
    },
  });

  const turnos: TurnoConEmpleado[] = cuadrantes.flatMap((c) => c.turnos);
  const { horas: horasPlan, coste } = resumenTurnos(turnos);

  // Horas extra por empleado
  const porEmpleado = new Map<string, { turnos: TurnoConEmpleado[]; horasContrato: number }>();
  for (const c of cuadrantes) {
    for (const t of c.turnos) {
      const k = t.empleadoId;
      if (!porEmpleado.has(k))
        porEmpleado.set(k, {
          turnos: [],
          horasContrato: t.empleado?.contrato?.horasSemana ?? 40,
        });
      porEmpleado.get(k)!.turnos.push(t);
    }
  }
  const extra = horasExtra(porEmpleado);

  const [solicitudesPendientes, cambiosPendientes, ausencias] = await Promise.all([
    prisma.ausencia.count({
      where: { estado: "PENDIENTE", empleado: { ubicacionId: { in: ambito } } },
    }),
    prisma.cambioTurno.count({
      where: {
        estado: { in: ["PROPUESTO", "ACEPTADO", "PENDIENTE_APROBACION"] },
        turnoOrigen: { empleado: { ubicacionId: { in: ambito } } },
      },
    }),
    prisma.ausencia.findMany({
      where: { estado: "PENDIENTE", empleado: { ubicacionId: { in: ambito } } },
      include: { empleado: { select: { nombre: true, apellidos: true, color: true, rolFuncional: true } } },
      orderBy: { creadoEn: "desc" },
      take: 5,
    }),
  ]);

  const sinDatos = cuadrantes.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={`Hola, ${usuario.nombre.split(" ")[0]} 👋`}
        descripcion={`Resumen de la semana · ${rangoSemanaTexto(lunes)}`}
      />

      {sinDatos ? (
        <EmptyState
          icon={Sparkles}
          titulo="Aún no hay cuadrante para esta semana"
          descripcion="Empieza importando tu Excel de forma automática o crea un cuadrante manualmente."
        >
          <div className="flex gap-2">
            <Link
              href="/onboarding"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Sparkles className="size-4" /> Importar Excel Automáticamente
            </Link>
            <Link
              href="/cuadrantes"
              className="inline-flex h-9 items-center rounded-md border border-input bg-card px-4 text-sm font-medium hover:bg-muted"
            >
              Ir a cuadrantes
            </Link>
          </div>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard etiqueta="Coste laboral (semana)" valor={euros(coste)} icon={Euro} />
          <KpiCard etiqueta="Horas planificadas" valor={horas(horasPlan)} icon={Clock} tono="accent" />
          <KpiCard
            etiqueta="Horas extra"
            valor={horas(extra)}
            icon={AlarmClock}
            tono={extra > 0 ? "warning" : "success"}
          />
          <KpiCard
            etiqueta="Solicitudes pendientes"
            valor={String(solicitudesPendientes + cambiosPendientes)}
            icon={Plane}
            tono={solicitudesPendientes + cambiosPendientes > 0 ? "warning" : "default"}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Tareas pendientes */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Tareas pendientes</CardTitle>
            <Link
              href="/vacaciones"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Ver todas <ArrowRight className="size-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {ausencias.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nada pendiente. Todo en orden. ✅
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {ausencias.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <Avatar
                      nombre={(a.empleado.nombre[0] ?? "") + (a.empleado.apellidos?.[0] ?? "")}
                      color={a.empleado.color ?? undefined}
                      size={32}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {a.empleado.nombre} {a.empleado.apellidos}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Solicita {a.tipo.toLowerCase()} · {etiquetaRol(a.empleado.rolFuncional)}
                      </p>
                    </div>
                    <StatusBadge estado={a.estado} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Avisos del sistema */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-accent" /> Avisos del sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              El detector de problemas analiza el cuadrante en busca de huecos,
              exceso de horas y solapamientos.
            </p>
            <Link
              href="/cuadrantes"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Revisar el cuadrante <ArrowRight className="size-3.5" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
