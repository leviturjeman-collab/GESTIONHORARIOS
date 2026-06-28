import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Euro, Clock, AlarmClock, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireSesion, resolverAmbito } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { esResponsable } from "@/lib/rbac";
import { semanaDesdeParam, diasDeSemana, rangoSemanaTexto } from "@/lib/fechas";
import { DIAS_SEMANA_CORTO, euros, horas, horasTurno, iniciales } from "@/lib/utils";
import { resumenTurnos, horasExtra, type TurnoConEmpleado } from "@/lib/metricas";
import { PageHeader } from "@/components/layout/page-header";
import { WeekSelector } from "@/components/layout/week-selector";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { CostChart } from "@/features/costes/cost-chart";

export default async function CostesPage({
  searchParams,
}: {
  searchParams: { ubicacion?: string; semana?: string };
}) {
  const usuario = await requireSesion();
  if (!esResponsable(usuario)) redirect("/inicio");
  const ambito = await resolverAmbito(usuario, searchParams.ubicacion);
  const lunes = semanaDesdeParam(searchParams.semana);
  const dias = diasDeSemana(lunes);

  const cuadrantes = await prisma.cuadrante.findMany({
    where: { ubicacionId: { in: ambito }, semanaInicio: lunes },
    include: { turnos: { include: { empleado: { include: { contrato: true } } } } },
  });
  const turnos = cuadrantes.flatMap((c) => c.turnos);
  const { coste, horas: horasPlan } = resumenTurnos(turnos);

  // Coste por día
  const porDia = dias.map((d, i) => {
    const delDia = turnos.filter((t) => sameDay(t.dia, d));
    const c = delDia.reduce(
      (acc, t) => acc + horasTurno(t) * (t.empleado?.contrato?.costeHora ?? 0),
      0
    );
    return { dia: DIAS_SEMANA_CORTO[i], coste: Math.round(c) };
  });

  // Horas extra
  const mapEmp = new Map<string, { turnos: TurnoConEmpleado[]; horasContrato: number }>();
  // Desglose por empleado
  const desglose = new Map<string, { nombre: string; apellidos: string | null; color: string | null; horas: number; coste: number }>();
  for (const t of turnos) {
    const id = t.empleadoId;
    if (!mapEmp.has(id))
      mapEmp.set(id, { turnos: [], horasContrato: t.empleado?.contrato?.horasSemana ?? 40 });
    mapEmp.get(id)!.turnos.push(t);
    const h = horasTurno(t);
    const c = h * (t.empleado?.contrato?.costeHora ?? 0);
    const prev = desglose.get(id) ?? {
      nombre: t.empleado?.nombre ?? "",
      apellidos: t.empleado?.apellidos ?? null,
      color: t.empleado?.color ?? null,
      horas: 0,
      coste: 0,
    };
    desglose.set(id, { ...prev, horas: prev.horas + h, coste: prev.coste + c });
  }
  const extra = horasExtra(mapEmp);
  const filas = [...desglose.values()].sort((a, b) => b.coste - a.coste);

  return (
    <div className="space-y-6">
      <PageHeader titulo="Costes laborales" descripcion={rangoSemanaTexto(lunes)}>
        <a
          href={`/api/export/costes?semana=${format(lunes, "yyyy-MM-dd")}${searchParams.ubicacion ? `&ubicacion=${searchParams.ubicacion}` : ""}`}
        >
          <Button variant="outline">
            <Download /> Excel
          </Button>
        </a>
        <WeekSelector semanaISO={format(lunes, "yyyy-MM-dd")} />
      </PageHeader>

      {turnos.length === 0 ? (
        <EmptyState icon={Euro} titulo="Sin datos de coste" descripcion="No hay turnos planificados esta semana." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard etiqueta="Coste de la semana" valor={euros(coste)} icon={Euro} />
            <KpiCard etiqueta="Horas planificadas" valor={horas(horasPlan)} icon={Clock} tono="accent" />
            <KpiCard etiqueta="Horas extra" valor={horas(extra)} icon={AlarmClock} tono={extra > 0 ? "warning" : "success"} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Coste por día</CardTitle>
            </CardHeader>
            <CardContent>
              <CostChart datos={porDia} costeTotal={coste} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Desglose por empleado</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {filas.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 py-2.5">
                    <Avatar nombre={iniciales(f.nombre, f.apellidos)} color={f.color ?? undefined} size={30} />
                    <span className="flex-1 text-sm font-medium">
                      {f.nombre} {f.apellidos}
                    </span>
                    <span className="text-sm text-muted-foreground">{horas(f.horas)}</span>
                    <span className="w-20 text-right text-sm font-semibold tabular-nums">{euros(f.coste)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
