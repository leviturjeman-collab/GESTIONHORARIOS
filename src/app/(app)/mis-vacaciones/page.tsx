import { Plane } from "lucide-react";
import { requireSesion } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { fechaCorta } from "@/lib/fechas";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { RequestForm } from "@/features/vacaciones/request-form";

function diasInclusive(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

export default async function MisVacacionesPage() {
  const usuario = await requireSesion();
  const anio = new Date().getFullYear();

  if (!usuario.empleadoId) {
    return (
      <div className="space-y-6">
        <PageHeader titulo="Mis vacaciones" />
        <EmptyState icon={Plane} titulo="Sin ficha de empleado" descripcion="Contacta con tu responsable." />
      </div>
    );
  }

  const [empleado, ausencias] = await Promise.all([
    prisma.empleado.findUnique({ where: { id: usuario.empleadoId } }),
    prisma.ausencia.findMany({
      where: { empleadoId: usuario.empleadoId },
      orderBy: { fechaInicio: "desc" },
    }),
  ]);

  const usado = ausencias
    .filter((a) => a.estado === "APROBADA" && a.tipo === "VACACIONES" && a.fechaInicio.getFullYear() === anio)
    .reduce((acc, a) => acc + diasInclusive(a.fechaInicio, a.fechaFin), 0);
  const saldo = empleado?.saldoVacaciones ?? 30;

  return (
    <div className="space-y-6">
      <PageHeader titulo="Mis vacaciones" descripcion={`Año ${anio}`}>
        <RequestForm />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard etiqueta="Días disponibles" valor={String(saldo - usado)} icon={Plane} tono="accent" />
        <KpiCard etiqueta="Días consumidos" valor={String(usado)} />
        <KpiCard etiqueta="Saldo anual" valor={String(saldo)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mis solicitudes</CardTitle>
        </CardHeader>
        <CardContent>
          {ausencias.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aún no has solicitado ninguna ausencia.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {ausencias.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium capitalize">{a.tipo.toLowerCase()}</p>
                    <p className="text-xs text-muted-foreground">
                      {fechaCorta(a.fechaInicio)} → {fechaCorta(a.fechaFin)} ·{" "}
                      {diasInclusive(a.fechaInicio, a.fechaFin)} días
                      {a.comentarioResolucion ? ` · "${a.comentarioResolucion}"` : ""}
                    </p>
                  </div>
                  <StatusBadge estado={a.estado} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
