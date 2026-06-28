import { Repeat } from "lucide-react";
import { requireSesion, resolverAmbito } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { esResponsable } from "@/lib/rbac";
import { fechaCorta, lunesDeSemana } from "@/lib/fechas";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { RespondButtons, ApproveButtons, ProposeForm } from "@/features/cambios/buttons";

export default async function CambiosPage({
  searchParams,
}: {
  searchParams: { ubicacion?: string };
}) {
  const usuario = await requireSesion();
  const responsable = esResponsable(usuario);

  if (responsable) {
    const ambito = await resolverAmbito(usuario, searchParams.ubicacion);
    const cambios = await prisma.cambioTurno.findMany({
      where: { turnoOrigen: { empleado: { ubicacionId: { in: ambito } } } },
      include: {
        solicitante: { select: { nombre: true, apellidos: true } },
        destino: { select: { nombre: true, apellidos: true } },
        turnoOrigen: { select: { dia: true, horaInicio: true, horaFin: true } },
      },
      orderBy: { creadoEn: "desc" },
    });
    const pendientes = cambios.filter((c) => c.estado === "PENDIENTE_APROBACION");

    return (
      <div className="space-y-6">
        <PageHeader titulo="Cambios de turno" descripcion="Valida los intercambios de tu equipo." />
        <Card>
          <CardHeader>
            <CardTitle>Pendientes de aprobación</CardTitle>
          </CardHeader>
          <CardContent>
            {pendientes.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nada pendiente.</p>
            ) : (
              <ul className="divide-y divide-border">
                {pendientes.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {c.solicitante.nombre} → {c.destino?.nombre ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Turno {fechaCorta(c.turnoOrigen.dia)} · {c.turnoOrigen.horaInicio}–{c.turnoOrigen.horaFin}
                      </p>
                    </div>
                    <ApproveButtons id={c.id} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historial</CardTitle>
          </CardHeader>
          <CardContent>
            {cambios.length === 0 ? (
              <EmptyState icon={Repeat} titulo="Sin cambios todavía" />
            ) : (
              <ul className="divide-y divide-border">
                {cambios.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        {c.solicitante.nombre} → {c.destino?.nombre ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fechaCorta(c.turnoOrigen.dia)} · {c.turnoOrigen.horaInicio}–{c.turnoOrigen.horaFin}
                      </p>
                    </div>
                    <StatusBadge estado={c.estado} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Vista de empleado ──
  if (!usuario.empleadoId) {
    return (
      <div className="space-y-6">
        <PageHeader titulo="Cambios de turno" />
        <EmptyState icon={Repeat} titulo="Sin ficha de empleado" />
      </div>
    );
  }

  const emp = await prisma.empleado.findUnique({
    where: { id: usuario.empleadoId },
    select: { ubicacionId: true },
  });
  const lunes = lunesDeSemana();

  const [paraMi, mias, misTurnos, companeros] = await Promise.all([
    prisma.cambioTurno.findMany({
      where: { destinoId: usuario.empleadoId, estado: "PROPUESTO" },
      include: {
        solicitante: { select: { nombre: true, apellidos: true } },
        turnoOrigen: { select: { dia: true, horaInicio: true, horaFin: true } },
      },
    }),
    prisma.cambioTurno.findMany({
      where: { solicitanteId: usuario.empleadoId },
      include: {
        destino: { select: { nombre: true } },
        turnoOrigen: { select: { dia: true, horaInicio: true, horaFin: true } },
      },
      orderBy: { creadoEn: "desc" },
    }),
    prisma.turno.findMany({
      where: { empleadoId: usuario.empleadoId, dia: { gte: lunes } },
      orderBy: { dia: "asc" },
      take: 20,
    }),
    prisma.empleado.findMany({
      where: { ubicacionId: emp?.ubicacionId ?? undefined, id: { not: usuario.empleadoId }, estado: "ACTIVO" },
      select: { id: true, nombre: true, apellidos: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader titulo="Cambios de turno" descripcion="Propón e intercambia turnos con tu equipo.">
        <ProposeForm
          turnos={misTurnos.map((t) => ({
            id: t.id,
            label: `${fechaCorta(t.dia)} · ${t.horaInicio}–${t.horaFin}`,
          }))}
          companeros={companeros.map((c) => ({ id: c.id, nombre: `${c.nombre} ${c.apellidos ?? ""}`.trim() }))}
        />
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Propuestas para ti</CardTitle>
        </CardHeader>
        <CardContent>
          {paraMi.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No tienes propuestas.</p>
          ) : (
            <ul className="divide-y divide-border">
              {paraMi.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {c.solicitante.nombre} te ofrece un turno
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fechaCorta(c.turnoOrigen.dia)} · {c.turnoOrigen.horaInicio}–{c.turnoOrigen.horaFin}
                      {c.mensaje ? ` · "${c.mensaje}"` : ""}
                    </p>
                  </div>
                  <RespondButtons id={c.id} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mis propuestas</CardTitle>
        </CardHeader>
        <CardContent>
          {mias.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No has propuesto cambios.</p>
          ) : (
            <ul className="divide-y divide-border">
              {mias.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">Para {c.destino?.nombre ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {fechaCorta(c.turnoOrigen.dia)} · {c.turnoOrigen.horaInicio}–{c.turnoOrigen.horaFin}
                    </p>
                  </div>
                  <StatusBadge estado={c.estado} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
