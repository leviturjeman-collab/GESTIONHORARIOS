import { Suspense } from "react";
import { esResponsable, esAdmin } from "@/lib/rbac";
import { LocationSelector } from "@/components/layout/location-selector";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { MobileNav } from "@/components/layout/mobile-nav";

type Ubic = { id: string; nombre: string };

export function Topbar({
  usuario,
  ubicaciones,
  noLeidas,
}: {
  usuario: { nombre: string; email: string; rol: string };
  ubicaciones: Ubic[];
  noLeidas: number;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur lg:px-6">
      <MobileNav rol={usuario.rol} />

      {esResponsable(usuario) && ubicaciones.length > 0 && (
        <Suspense>
          <LocationSelector ubicaciones={ubicaciones} permitirTodas={esAdmin(usuario)} />
        </Suspense>
      )}

      <div className="flex-1" />

      <NotificationsBell count={noLeidas} />
      <UserMenu nombre={usuario.nombre} email={usuario.email} rol={usuario.rol} />
    </header>
  );
}
