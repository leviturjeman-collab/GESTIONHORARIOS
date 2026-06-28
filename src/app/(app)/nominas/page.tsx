import { redirect } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireSesion, resolverAmbito } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { esResponsable } from "@/lib/rbac";
import { horas as horasFmt, horasTurno, iniciales } from "@/lib/utils";
import { etiquetaRol } from "@/lib/enums";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
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
import { DocUpload } from "@/features/documentos/doc-upload";

export default async function NominasPage({
  searchParams,
}: {
  searchParams: { ubicacion?: string };
}) {
  const usuario = await requireSesion();
  if (!esResponsable(usuario)) redirect("/mi-perfil");
  const ambito = await resolverAmbito(usuario, searchParams.ubicacion);

  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);

  const empleados = await prisma.empleado.findMany({
    where: { ubicacionId: { in: ambito }, estado: "ACTIVO" },
    include: {
      turnos: { where: { dia: { gte: inicioMes, lt: finMes } } },
      documentos: true,
    },
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Nóminas y contratos"
        descripcion={`Resumen de horas de ${format(ahora, "MMMM yyyy", { locale: es })} para la gestoría`}
      >
        <a href={`/api/export/horas?formato=pdf${searchParams.ubicacion ? `&ubicacion=${searchParams.ubicacion}` : ""}`}>
          <Button variant="outline">
            <Download /> PDF
          </Button>
        </a>
        <a href={`/api/export/horas${searchParams.ubicacion ? `?ubicacion=${searchParams.ubicacion}` : ""}`}>
          <Button variant="outline">
            <Download /> Excel
          </Button>
        </a>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Resumen de horas del mes</CardTitle>
          <CardDescription>
            En la v1 la app no calcula importes: prepara y entrega la información de horas
            a la gestoría y custodia los documentos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Horas del mes</TableHead>
                <TableHead>Documentos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empleados.map((e) => {
                const horasMes = e.turnos.reduce((a, t) => a + horasTurno(t), 0);
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar nombre={iniciales(e.nombre, e.apellidos)} color={e.color ?? undefined} size={30} />
                        <span className="text-sm font-medium">
                          {e.nombre} {e.apellidos}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="neutral">{etiquetaRol(e.rolFuncional)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium tabular-nums">{horasFmt(horasMes)}</TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {e.documentos.map((d) => (
                          <a
                            key={d.id}
                            href={`/api/documentos/${d.id}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-xs hover:border-primary"
                          >
                            <FileText className="size-3" /> {d.tipo.toLowerCase()}
                          </a>
                        ))}
                        <DocUpload empleadoId={e.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
