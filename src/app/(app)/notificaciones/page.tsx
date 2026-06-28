import Link from "next/link";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { requireSesion } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MarkAllRead } from "@/features/notificaciones/mark-read";

export default async function NotificacionesPage() {
  const usuario = await requireSesion();
  const notificaciones = await prisma.notificacion.findMany({
    where: { destinatarioId: usuario.id },
    orderBy: { creadoEn: "desc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader titulo="Notificaciones">
        {notificaciones.some((n) => !n.leida) && <MarkAllRead />}
      </PageHeader>

      {notificaciones.length === 0 ? (
        <EmptyState icon={Bell} titulo="Sin notificaciones" descripcion="Aquí verás los avisos importantes." />
      ) : (
        <Card className="divide-y divide-border">
          {notificaciones.map((n) => {
            const contenido = (
              <div className={cn("flex gap-3 p-4", !n.leida && "bg-primary/5")}>
                <div className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.leida ? "bg-transparent" : "bg-primary")} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{n.titulo}</p>
                  <p className="text-sm text-muted-foreground">{n.cuerpo}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDistanceToNow(n.creadoEn, { addSuffix: true, locale: es })}
                  </p>
                </div>
              </div>
            );
            return n.enlace ? (
              <Link key={n.id} href={n.enlace} className="block hover:bg-muted/40">
                {contenido}
              </Link>
            ) : (
              <div key={n.id}>{contenido}</div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
