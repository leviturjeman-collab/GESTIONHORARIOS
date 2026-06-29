import { redirect } from "next/navigation";
import { format } from "date-fns";
import { CalendarRange } from "lucide-react";
import { requireSesion, resolverAmbito } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { esResponsable } from "@/lib/rbac";
import { semanaDesdeParam, diasDeSemana, dateToISOLocal } from "@/lib/fechas";
import { evaluarCobertura } from "@/lib/cuadrante";
import { PageHeader } from "@/components/layout/page-header";
import { WeekSelector } from "@/components/layout/week-selector";
import { EmptyState } from "@/components/ui/empty-state";
import { PlanningBoard } from "@/features/cuadrante/planning-board";

export default async function CuadrantesPage({
  searchParams,
}: {
  searchParams: { ubicacion?: string; semana?: string };
}) {
  const usuario = await requireSesion();
  if (!esResponsable(usuario)) redirect("/mi-cuadrante");

  const ambito = await resolverAmbito(usuario, searchParams.ubicacion);
  // El cuadrante es por ubicación concreta: elige la seleccionada o la primera.
  const ubicacionId = searchParams.ubicacion && ambito.includes(searchParams.ubicacion)
    ? searchParams.ubicacion
    : ambito[0];

  if (!ubicacionId) {
    return (
      <EmptyState
        icon={CalendarRange}
        titulo="Sin ubicaciones"
        descripcion="Crea una ubicación para empezar a planificar."
      />
    );
  }

  const lunes = semanaDesdeParam(searchParams.semana);
  const dias = diasDeSemana(lunes);
  const semanaISO = format(lunes, "yyyy-MM-dd");
  const diasISO = dias.map((d) => dateToISOLocal(d));

  const [ubic, empleados, cuadrante, reglas, plantillas, ausencias, disponibilidades] = await Promise.all([
    prisma.ubicacion.findUnique({ where: { id: ubicacionId } }),
    prisma.empleado.findMany({
      where: { ubicacionId, estado: "ACTIVO" },
      include: { contrato: true },
      orderBy: [{ rolFuncional: "asc" }, { nombre: "asc" }],
    }),
    prisma.cuadrante.findUnique({
      where: { ubicacionId_semanaInicio: { ubicacionId, semanaInicio: lunes } },
      include: { turnos: true },
    }),
    prisma.coberturaMinima.findMany({ where: { ubicacionId } }),
    prisma.plantilla.findMany({
      where: { ubicacionId },
      select: { id: true, nombre: true },
      orderBy: { creadoEn: "desc" },
    }),
    // Ausencias APROBADAS que solapan esta semana → recomendaciones de planificación.
    prisma.ausencia.findMany({
      where: {
        empleado: { ubicacionId },
        estado: { not: "RECHAZADA" },
        fechaInicio: { lte: dias[6] },
        fechaFin: { gte: dias[0] },
      },
      include: { empleado: { select: { id: true, nombre: true, apellidos: true } } },
    }),
    prisma.disponibilidad.findMany({
      where: { empleado: { ubicacionId } },
    }),
  ]);

  const turnos = cuadrante?.turnos ?? [];
  const diaIdxDe = (d: Date) => Math.round((new Date(dateToISOLocal(d)).getTime() - new Date(dateToISOLocal(lunes)).getTime()) / 86400000);

  // Recomendaciones y bloqueos por ausencia aprobada
  const bloqueos: { empleadoId: string; diaIdx: number; tipo: string }[] = [];
  const recomendaciones = ausencias.map((a) => {
    const idxs: number[] = [];
    const aInicioStr = dateToISOLocal(a.fechaInicio);
    const aFinStr = dateToISOLocal(a.fechaFin);

    dias.forEach((d, i) => {
      const dStr = dateToISOLocal(d);
      if (dStr >= aInicioStr && dStr <= aFinStr) {
        idxs.push(i);
        bloqueos.push({ empleadoId: a.empleadoId, diaIdx: i, tipo: a.tipo });
      }
    });
    return {
      empleadoId: a.empleadoId,
      nombre: `${a.empleado.nombre} ${a.empleado.apellidos ?? ""}`.trim(),
      tipo: a.tipo as string,
      diasIdx: idxs,
    };
  });

  const cobertura = evaluarCobertura(
    reglas.map((r) => ({
      rol: r.rol,
      diaSemana: r.diaSemana,
      franjaInicio: r.franjaInicio,
      franjaFin: r.franjaFin,
      minPersonas: r.minPersonas,
    })),
    turnos.map((t) => ({ ...t, dia: t.dia })),
    dias
  );

  const esModoTodas = !searchParams.ubicacion && ambito.length > 1;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Cuadrante"
        descripcion={ubic?.nombre ?? "Planificación semanal"}
      >
        <WeekSelector semanaISO={semanaISO} />
      </PageHeader>

      <PlanningBoard
        ubicacionId={ubicacionId}
        semanaISO={semanaISO}
        estado={cuadrante?.estado ?? "BORRADOR"}
        empleados={empleados.map((e) => ({
          id: e.id,
          nombre: e.nombre,
          apellidos: e.apellidos,
          rol: e.rolFuncional,
          color: e.color,
          horasContrato: e.contrato?.horasSemana ?? 40,
          diasDescanso: e.contrato?.diasDescanso ?? 2,
          tipoContrato: e.contrato?.tipo ?? "INDEFINIDO_COMPLETO",
          preferenciaTurno: e.contrato?.preferenciaTurno ?? "INDIFERENTE",
          permitePartido: e.contrato?.permitePartido ?? true,
          admiteHorasExtra: e.contrato?.admiteHorasExtra ?? true,
        }))}
        turnos={turnos.map((t) => ({
          id: t.id,
          empleadoId: t.empleadoId,
          diaIdx: diaIdxDe(t.dia),
          horaInicio: t.horaInicio,
          horaFin: t.horaFin,
          partido: t.partido,
          horaInicio2: t.horaInicio2,
          horaFin2: t.horaFin2,
          rol: t.rol,
          descansoMin: t.descansoMin,
          notes: t.notas,
          notas: t.notas,
        }))}
        cobertura={cobertura}
        plantillas={plantillas}
        diasISO={diasISO}
        recomendaciones={recomendaciones}
        bloqueos={bloqueos}
        puedeDeshacer={!!cuadrante?.snapshotAnterior}
        ubicacionAjustes={ubic?.ajustes ?? "{}"}
        ubicHoraApertura={ubic?.horaApertura ?? "09:00"}
        ubicHoraCierre={ubic?.horaCierre ?? "23:00"}
        disponibilidades={disponibilidades}
        esModoTodas={esModoTodas}
      />
    </div>
  );
}


