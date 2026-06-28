import { CalendarCheck } from "lucide-react";
import { format } from "date-fns";
import { requireSesion } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AvailabilityGrid } from "@/features/disponibilidad/availability-grid";

export default async function MiDisponibilidadPage() {
  const usuario = await requireSesion();
  if (!usuario.empleadoId) {
    return (
      <div className="space-y-6">
        <PageHeader titulo="Mi disponibilidad" />
        <EmptyState icon={CalendarCheck} titulo="Sin ficha de empleado" descripcion="Contacta con tu responsable." />
      </div>
    );
  }

  const disponibilidades = await prisma.disponibilidad.findMany({
    where: { empleadoId: usuario.empleadoId },
  });
  const inicialRecurrentes = disponibilidades
    .filter((d) => d.recurrente && d.diaSemana != null)
    .map((d) => ({
      diaSemana: d.diaSemana!,
      estado: d.estado,
      franjaInicio: d.franjaInicio,
      franjaFin: d.franjaFin,
    }));
  const inicialExcepciones = disponibilidades
    .filter((d) => !d.recurrente && d.fecha)
    .map((d) => ({
      fecha: format(d.fecha!, "yyyy-MM-dd"),
      estado: d.estado,
      franjaInicio: d.franjaInicio,
      franjaFin: d.franjaFin,
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Mi disponibilidad"
        descripcion="Indica cuándo puedes o prefieres no trabajar. Tu responsable lo verá al planificar."
      />
      <Card>
        <CardHeader>
          <CardTitle>Disponibilidad semanal (recurrente)</CardTitle>
        </CardHeader>
        <CardContent>
          <AvailabilityGrid
            inicialRecurrentes={inicialRecurrentes}
            inicialExcepciones={inicialExcepciones}
          />
        </CardContent>
      </Card>
    </div>
  );
}
