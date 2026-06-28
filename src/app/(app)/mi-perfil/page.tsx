import { UserCircle } from "lucide-react";
import { requireSesion } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { horas as horasFmt, euros, iniciales } from "@/lib/utils";
import { etiquetaRol, etiquetaContrato } from "@/lib/enums";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

function diasInclusive(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

export default async function MiPerfilPage() {
  const usuario = await requireSesion();
  const anio = new Date().getFullYear();

  if (!usuario.empleadoId) {
    return (
      <div className="space-y-6">
        <PageHeader titulo="Mi perfil" />
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm">
              <span className="text-muted-foreground">Nombre:</span> {usuario.nombre}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Correo:</span> {usuario.email}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Rol:</span> {usuario.rol}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const empleado = await prisma.empleado.findUnique({
    where: { id: usuario.empleadoId },
    include: { contrato: true, ubicacion: { select: { nombre: true } }, documentos: true, ausencias: true },
  });
  if (!empleado) {
    return <EmptyState icon={UserCircle} titulo="Perfil no encontrado" />;
  }

  const usado = empleado.ausencias
    .filter((a) => a.estado === "APROBADA" && a.tipo === "VACACIONES" && a.fechaInicio.getFullYear() === anio)
    .reduce((acc, a) => acc + diasInclusive(a.fechaInicio, a.fechaFin), 0);

  return (
    <div className="space-y-6">
      <PageHeader titulo="Mi perfil" />

      <Card>
        <CardContent className="flex items-center gap-4 pt-6">
          <Avatar nombre={iniciales(empleado.nombre, empleado.apellidos)} color={empleado.color ?? undefined} size={56} />
          <div>
            <p className="text-lg font-semibold">
              {empleado.nombre} {empleado.apellidos}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="neutral">{etiquetaRol(empleado.rolFuncional)}</Badge>
              <span className="text-sm text-muted-foreground">{empleado.ubicacion?.nombre}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          etiqueta="Contrato"
          valor={empleado.contrato ? etiquetaContrato(empleado.contrato.tipo) : "—"}
          sub={empleado.contrato ? horasFmt(empleado.contrato.horasSemana) + "/semana" : undefined}
        />
        <KpiCard etiqueta="Coste/hora" valor={empleado.contrato ? euros(empleado.contrato.costeHora, true) : "—"} />
        <KpiCard etiqueta="Vacaciones disponibles" valor={String(empleado.saldoVacaciones - usado)} sub={`de ${empleado.saldoVacaciones} días`} tono="accent" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos de contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <p><span className="text-muted-foreground">Correo:</span> {empleado.email ?? usuario.email}</p>
            <p><span className="text-muted-foreground">Teléfono:</span> {empleado.telefono ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Mis documentos</CardTitle>
          </CardHeader>
          <CardContent>
            {empleado.documentos.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tienes documentos todavía.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {empleado.documentos.map((d) => (
                  <li key={d.id}>
                    <a href={`/api/documentos/${d.id}`} target="_blank" className="text-primary hover:underline">
                      {d.nombre}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
