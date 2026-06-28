import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Building2, Users, Clock, Sparkles, Pencil, ListChecks } from "lucide-react";
import { CoberturaEditor } from "@/features/cobertura/cobertura-editor";
import { requireSesion } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { esAdmin } from "@/lib/rbac";
import { lunesDeSemana } from "@/lib/fechas";
import { resumenTurnos } from "@/lib/metricas";
import { euros } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LocationForm } from "@/features/ubicaciones/location-form";

export default async function UbicacionesPage() {
  const usuario = await requireSesion();
  if (!esAdmin(usuario)) redirect("/inicio");

  const lunes = lunesDeSemana();
  const [ubicaciones, managers] = await Promise.all([
    prisma.ubicacion.findMany({
      where: { organizacionId: usuario.organizacionId },
      include: {
        managers: { select: { id: true, nombre: true } },
        coberturas: true,
        _count: { select: { empleados: true } },
        cuadrantes: {
          where: { semanaInicio: lunes },
          include: { turnos: { include: { empleado: { include: { contrato: true } } } } },
        },
      },
      orderBy: { nombre: "asc" },
    }),
    prisma.usuario.findMany({
      where: { organizacionId: usuario.organizacionId, rol: "MANAGER" },
      select: { id: true, nombre: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader titulo="Ubicaciones" descripcion="Locales del negocio y su configuración">
        <Link href="/onboarding">
          <Button variant="outline">
            <Sparkles /> Importar Inteligentemente
          </Button>
        </Link>
        <LocationForm managers={managers}>
          <Button>
            <Plus /> Nueva ubicación
          </Button>
        </LocationForm>
      </PageHeader>

      {ubicaciones.length === 0 ? (
        <EmptyState
          icon={Building2}
          titulo="Sin ubicaciones"
          descripcion="Crea tu primera ubicación o impórtala automáticamente desde un Excel."
        >
          <LocationForm managers={managers}>
            <Button>
              <Plus /> Crear la primera
            </Button>
          </LocationForm>
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ubicaciones.map((u) => {
            const turnos = u.cuadrantes.flatMap((c) => c.turnos);
            const { coste } = resumenTurnos(turnos);
            return (
              <Card key={u.id} className="flex flex-col">
                <CardContent className="flex-1 pt-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Building2 className="size-5" />
                      </div>
                      <div>
                        <p className="font-semibold">{u.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {u.direccion ?? "Sin dirección"}
                        </p>
                      </div>
                    </div>
                    {!u.activa && <Badge variant="neutral">Inactiva</Badge>}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="size-3" /> Equipo
                      </p>
                      <p className="font-semibold">{u._count.empleados}</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" /> Horario
                      </p>
                      <p className="text-xs font-semibold">
                        {u.horaApertura}–{u.horaCierre}
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-xs text-muted-foreground">Coste sem.</p>
                      <p className="font-semibold">{euros(coste)}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Manager:</span>
                    {u.managers.length ? (
                      u.managers.map((m) => (
                        <Badge key={m.id} variant="default">{m.nombre}</Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">sin asignar</span>
                    )}
                    {u.requiereAprobacionCambios && (
                      <Badge variant="info">Aprobación de cambios</Badge>
                    )}
                  </div>
                </CardContent>
                <div className="flex items-center justify-end gap-1 border-t border-border p-3">
                  <CoberturaEditor ubicacionId={u.id} coberturas={u.coberturas}>
                    <Button variant="ghost" size="sm">
                      <ListChecks /> Cobertura ({u.coberturas.length})
                    </Button>
                  </CoberturaEditor>
                  <LocationForm managers={managers} ubicacion={u}>
                    <Button variant="ghost" size="sm">
                      <Pencil /> Editar
                    </Button>
                  </LocationForm>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
