import { requireSesion, getContexto } from "@/lib/session";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await requireSesion();
  const { ubicaciones, noLeidas } = await getContexto(usuario);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar rol={usuario.rol} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar usuario={usuario} ubicaciones={ubicaciones} noLeidas={noLeidas} />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
