import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, Tablet, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireSesion, resolverAmbito } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { esResponsable } from "@/lib/rbac";
import { horaTexto, fechaLarga, format } from "@/lib/fechas";
import { iniciales } from "@/lib/utils";
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
import { EmptyState } from "@/components/ui/empty-state";
import { CorregirFichaje } from "@/features/fichaje/corregir-fichaje";

export default async function FichajePage({
  searchParams,
}: {
  searchParams: { ubicacion?: string };
}) {
  const usuario = await requireSesion();
  if (!esResponsable(usuario)) redirect("/fichar");
  const ambito = await resolverAmbito(usuario, searchParams.ubicacion);

  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 1);

  const empleados = await prisma.empleado.findMany({
    where: { ubicacionId: { in: ambito }, estado: "ACTIVO" },
    include: {
      turnos: { where: { dia: { gte: inicio, lt: fin } }, orderBy: { horaInicio: "asc" } },
      fichajes: { where: { entrada: { gte: inicio, lt: fin } }, orderBy: { entrada: "desc" } },
    },
    orderBy: { nombre: "asc" },
  });

  const conActividad = empleados.filter((e) => e.turnos.length > 0 || e.fichajes.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader titulo="Fichaje" descripcion={`Control horario · ${fechaLarga(new Date())}`}>
        <a href={`/api/export/fichajes${searchParams.ubicacion ? `?ubicacion=${searchParams.ubicacion}` : ""}`}>
          <Button variant="outline">
            <Download /> Exportar
          </Button>
        </a>
        <Link href="/fichaje/tablet">
          <Button variant="outline">
            <Tablet /> Modo tablet
          </Button>
        </Link>
      </PageHeader>

      {conActividad.length === 0 ? (
        <EmptyState
          icon={Clock}
          titulo="Sin actividad hoy"
          descripcion="No hay turnos planificados ni fichajes registrados para hoy."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Planificado</TableHead>
                <TableHead>Real</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conActividad.map((e) => {
                const turno = e.turnos[0];
                const fichaje = e.fichajes[0];
                const incidencia = e.fichajes.find((f) => f.incidencia)?.incidencia;
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
                    <TableCell className="text-sm tabular-nums">
                      {turno ? `${turno.horaInicio}–${turno.horaFin}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {fichaje
                        ? `${horaTexto(fichaje.entrada)} → ${fichaje.salida ? horaTexto(fichaje.salida) : "…"}`
                        : "Sin fichar"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {incidencia ? (
                          <StatusBadge estado={incidencia} />
                        ) : fichaje ? (
                          fichaje.salida ? (
                            <Badge variant="neutral">Cerrado</Badge>
                          ) : (
                            <Badge variant="success">Trabajando</Badge>
                          )
                        ) : turno ? (
                          <Badge variant="warning">Pendiente</Badge>
                        ) : (
                          <Badge variant="neutral">—</Badge>
                        )}
                        {fichaje?.corregido && <Badge variant="info">Corregido</Badge>}
                        {fichaje ? (
                          <CorregirFichaje
                            fichajeId={fichaje.id}
                            entradaFecha={format(fichaje.entrada, "yyyy-MM-dd")}
                            entradaHora={horaTexto(fichaje.entrada)}
                            salidaFecha={fichaje.salida ? format(fichaje.salida, "yyyy-MM-dd") : format(fichaje.entrada, "yyyy-MM-dd")}
                            salidaHora={fichaje.salida ? horaTexto(fichaje.salida) : ""}
                          />
                        ) : (
                          <CorregirFichaje
                            empleadoId={e.id}
                            entradaFecha={format(new Date(), "yyyy-MM-dd")}
                            entradaHora={turno ? turno.horaInicio : "09:00"}
                            salidaFecha={format(new Date(), "yyyy-MM-dd")}
                            salidaHora={turno ? turno.horaFin : "17:00"}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
