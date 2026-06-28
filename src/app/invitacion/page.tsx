import { Suspense } from "react";
import { CalendarClock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { InviteForm } from "@/app/invitacion/invite-form";

export default function InvitacionPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <CalendarClock className="size-6 text-primary" />
          <span className="text-lg font-semibold">Gestión Horarios</span>
        </div>
        <div className="mb-4 text-center">
          <h1 className="text-xl font-semibold">Activa tu cuenta</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea tu contraseña para acceder a la aplicación.
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <Suspense>
              <InviteForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
