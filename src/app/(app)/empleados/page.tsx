import { Plus, Users } from "lucide-react";
import { requireSesion, resolverAmbito } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { esResponsable, esAdmin } from "@/lib/rbac";
import { etiquetaRol, etiquetaContrato } from "@/lib/enums";
import { euros, horas, iniciales } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { EmployeeForm } from "@/features/empleados/employee-form";
import { EmployeeRowActions } from "@/features/empleados/row-actions";
import { redirect } from "next/navigation";

export default async function EmpleadosPage({
  searchParams,
}: {
  searchParams: { ubicacion?: string };
}) {
  const usuario = await requireSesion();
  if (!esResponsable(usuario)) redirect("/mi-cuadrante");

  const ambito = await resolverAmbito(usuario, searchParams.ubicacion);
  const [empleados, ubicaciones] = await Promise.all([
    prisma.empleado.findMany({
      where: { ubicacionId: { in: ambito } },
      include: { contrato: true, ubicacion: { select: { nombre: true } } },
      orderBy: [{ estado: "asc" }, { nombre: "asc" }],
    }),
    prisma.ubicacion.findMany({
      where: { id: { in: ambito } },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader titulo="Empleados" descripcion={`${empleados.length} personas en el equipo`}>
        <EmployeeForm ubicaciones={ubicaciones}>
          <Button>
            <Plus /> Nuevo empleado
          </Button>
        </EmployeeForm>
      </PageHeader>

      {empleados.length === 0 ? (
        <EmptyState
          icon={Users}
          titulo="Aún no hay empleados"
          descripcion="Crea empleados manualmente o impórtalos de forma automática desde un Excel."
        >
          <EmployeeForm ubicaciones={ubicaciones}>
            <Button>
              <Plus /> Nuevo empleado
            </Button>
          </EmployeeForm>
        </EmptyState>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Acceso (PIN)</TableHead>
                <TableHead>Coste/h</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {empleados.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <EmployeeForm ubicaciones={ubicaciones} empleado={e as any}>
                      <button className="flex w-full items-center gap-3 rounded-md text-left transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        <Avatar
                          nombre={iniciales(e.nombre, e.apellidos)}
                          color={e.color ?? undefined}
                          size={34}
                        />
                        <div>
                          <p className="font-medium hover:underline">
                            {e.nombre} {e.apellidos}
                          </p>
                          <p className="text-xs text-muted-foreground">{e.email}</p>
                        </div>
                      </button>
                    </EmployeeForm>
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral">{etiquetaRol(e.rolFuncional)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {e.ubicacion?.nombre ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {e.contrato ? (
                      <span className="text-xs">
                        {etiquetaContrato(e.contrato.tipo)} · {horas(e.contrato.horasSemana)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {e.pinFichaje ? (
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-bold tracking-widest text-primary">{e.pinFichaje}</span>
                        {e.email ? <span className="text-[10px] text-muted-foreground">App + Tablet</span> : <span className="text-[10px] text-muted-foreground">Solo Tablet</span>}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {e.contrato ? euros(e.contrato.costeHora, true) : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge estado={e.estado} />
                  </TableCell>
                  <TableCell>
                    <EmployeeRowActions empleado={e} ubicaciones={ubicaciones} puedeRgpd={esAdmin(usuario)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
