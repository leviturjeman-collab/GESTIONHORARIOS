import { redirect } from "next/navigation";
import { Plane } from "lucide-react";
import { requireSesion, resolverAmbito } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { esResponsable } from "@/lib/rbac";
import { fechaCorta } from "@/lib/fechas";
import { iniciales } from "@/lib/utils";
import { etiquetaRol } from "@/lib/enums";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ResolveButtons } from "@/features/vacaciones/resolve-buttons";

function diasInclusive(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

export default async function VacacionesPage({
  searchParams,
}: {
  searchParams: { ubicacion?: string };
}) {
  const usuario = await requireSesion();
  if (!esResponsable(usuario)) redirect("/mis-vacaciones");
  const ambito = await resolverAmbito(usuario, searchParams.ubicacion);
  const anio = new Date().getFullYear();

  const [pendientes, aprobadas, empleados] = await Promise.all([
    prisma.ausencia.findMany({
      where: { estado: "PENDIENTE", empleado: { ubicacionId: { in: ambito } } },
      include: { empleado: true },
      orderBy: { creadoEn: "desc" },
    }),
    prisma.ausencia.findMany({
      where: {
        estado: "APROBADA",
        tipo: "VACACIONES",
        empleado: { ubicacionId: { in: ambito } },
        fechaInicio: { gte: new Date(anio, 0, 1) },
      },
      include: { empleado: { select: { id: true } } },
    }),
    prisma.empleado.findMany({
      where: { ubicacionId: { in: ambito }, estado: "ACTIVO" },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const usadoPorEmp = new Map<string, number>();
  for (const a of aprobadas) {
    const k = a.empleado.id;
    usadoPorEmp.set(k, (usadoPorEmp.get(k) ?? 0) + diasInclusive(a.fechaInicio, a.fechaFin));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Vacaciones y ausencias"
        descripcion="Aprueba solicitudes y consulta el saldo del equipo."
      />

      <Card>
        <CardHeader>
          <CardTitle>
            Solicitudes pendientes{" "}
            {pendientes.length > 0 && <Badge variant="warning">{pendientes.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendientes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hay solicitudes pendientes.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {pendientes.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar nombre={iniciales(a.empleado.nombre, a.empleado.apellidos)} color={a.empleado.color ?? undefined} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {a.empleado.nombre} {a.empleado.apellidos}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.tipo.toLowerCase()} · {fechaCorta(a.fechaInicio)} → {fechaCorta(a.fechaFin)} ·{" "}
                      {diasInclusive(a.fechaInicio, a.fechaFin)} días
                      {a.motivo ? ` · ${a.motivo}` : ""}
                    </p>
                  </div>
                  <ResolveButtons id={a.id} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saldo de vacaciones del equipo · {anio}</CardTitle>
        </CardHeader>
        <CardContent>
          {empleados.length === 0 ? (
            <EmptyState icon={Plane} titulo="Sin empleados" />
          ) : (
            <ul className="divide-y divide-border">
              {empleados.map((e) => {
                const usado = usadoPorEmp.get(e.id) ?? 0;
                const restante = e.saldoVacaciones - usado;
                return (
                  <li key={e.id} className="flex items-center gap-3 py-2.5">
                    <Avatar nombre={iniciales(e.nombre, e.apellidos)} color={e.color ?? undefined} size={30} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {e.nombre} {e.apellidos}
                      </p>
                      <p className="text-xs text-muted-foreground">{etiquetaRol(e.rolFuncional)}</p>
                    </div>
                    <div className="text-right text-sm">
                      <span className="font-semibold tabular-nums">{restante}</span>
                      <span className="text-muted-foreground"> / {e.saldoVacaciones} días</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
