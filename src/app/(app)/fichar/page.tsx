import { Clock } from "lucide-react";
import { requireSesion } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { horaTexto, fechaLarga } from "@/lib/fechas";
import { etiquetaRol } from "@/lib/enums";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { ClockButton } from "@/features/fichaje/clock-button";

export default async function FicharPage() {
  const usuario = await requireSesion();
  if (!usuario.empleadoId) {
    return (
      <div className="space-y-6">
        <PageHeader titulo="Fichar" />
        <EmptyState icon={Clock} titulo="Sin ficha de empleado" descripcion="Contacta con tu responsable." />
      </div>
    );
  }

  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 1);

  const [turno, abierto, fichajesHoy] = await Promise.all([
    prisma.turno.findFirst({
      where: { empleadoId: usuario.empleadoId, dia: { gte: inicio, lt: fin } },
      orderBy: { horaInicio: "asc" },
    }),
    prisma.fichaje.findFirst({ where: { empleadoId: usuario.empleadoId, salida: null } }),
    prisma.fichaje.findMany({
      where: { empleadoId: usuario.empleadoId, entrada: { gte: inicio, lt: fin } },
      orderBy: { entrada: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageHeader titulo="Fichar" descripcion={fechaLarga(new Date())} />

      <Card>
        <CardContent className="space-y-5 pt-6 text-center">
          <div>
            <p className="text-sm text-muted-foreground">Turno de hoy</p>
            {turno ? (
              <p className="mt-1 text-lg font-semibold">
                {turno.horaInicio}–{turno.horaFin} · {etiquetaRol(turno.rol)}
              </p>
            ) : (
              <p className="mt-1 text-lg font-semibold text-muted-foreground">Sin turno asignado</p>
            )}
          </div>

          <div className="rounded-lg bg-muted/40 py-4">
            <p className="text-sm text-muted-foreground">Estado</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {abierto ? `Trabajando desde ${horaTexto(abierto.entrada)}` : "Sin fichar"}
            </p>
          </div>

          <ClockButton abierto={!!abierto} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <p className="mb-3 text-sm font-medium">Fichajes de hoy</p>
          {fichajesHoy.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no has fichado hoy.</p>
          ) : (
            <ul className="space-y-2">
              {fichajesHoy.map((f) => (
                <li key={f.id} className="flex items-center justify-between text-sm">
                  <span className="tabular-nums">
                    {horaTexto(f.entrada)} → {f.salida ? horaTexto(f.salida) : "—"}
                  </span>
                  {f.incidencia && <StatusBadge estado={f.incidencia} />}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
