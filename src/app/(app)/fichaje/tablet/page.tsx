import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Tablet } from "lucide-react";
import { requireSesion, resolverAmbito } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { esResponsable } from "@/lib/rbac";
import { fechaLarga } from "@/lib/fechas";
import { EmptyState } from "@/components/ui/empty-state";
import { TabletBoard } from "@/features/fichaje/tablet-board";

export default async function TabletPage({
  searchParams,
}: {
  searchParams: { ubicacion?: string };
}) {
  const usuario = await requireSesion();
  if (!esResponsable(usuario)) redirect("/fichar");
  const ambito = await resolverAmbito(usuario, searchParams.ubicacion);
  const ubicacionId =
    searchParams.ubicacion && ambito.includes(searchParams.ubicacion)
      ? searchParams.ubicacion
      : ambito[0];

  if (!ubicacionId) {
    return <EmptyState icon={Tablet} titulo="Sin ubicación" descripcion="Crea una ubicación primero." />;
  }

  const [ubic, empleados] = await Promise.all([
    prisma.ubicacion.findUnique({ where: { id: ubicacionId }, select: { nombre: true } }),
    prisma.empleado.findMany({
      where: { ubicacionId, estado: "ACTIVO" },
      include: { fichajes: { where: { salida: null }, take: 1 } },
      orderBy: { nombre: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold sm:text-2xl">
            <Tablet className="size-6 text-primary" /> Fichaje · Modo tablet
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ubic?.nombre} · {fechaLarga(new Date())} · cada empleado ficha con su PIN
          </p>
        </div>
        <Link
          href="/fichaje"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="size-4" /> Salir
        </Link>
      </div>

      {empleados.length === 0 ? (
        <EmptyState icon={Tablet} titulo="Sin empleados en esta ubicación" />
      ) : (
        <TabletBoard
          empleados={empleados.map((e) => ({
            id: e.id,
            nombre: e.nombre,
            apellidos: e.apellidos,
            color: e.color,
            trabajando: e.fichajes.length > 0,
          }))}
        />
      )}
    </div>
  );
}
