import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { getSesion } from "@/lib/session";
import { rutaInicial } from "@/lib/rbac";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent } from "@/components/ui/card";

export default async function LoginPage() {
  const u = await getSesion();
  if (u) redirect(rutaInicial(u.rol));

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Panel izquierdo: marca */}
      <div className="relative hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <CalendarClock className="size-6" />
          Gestión Horarios
        </div>
        <div className="space-y-4">
          <h1 className="max-w-md text-3xl font-semibold leading-tight">
            Cuadrantes profesionales para hostelería, automatizados.
          </h1>
          <p className="max-w-md text-primary-foreground/80">
            Sube el Excel que ya usas, responde unas preguntas y ten tu cuadrante
            listo. Planifica, controla horas y comunica cambios sin esfuerzo.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/60">
          © {new Date().getFullYear()} Grupo Sabores del Sur
        </p>
      </div>

      {/* Panel derecho: formulario */}
      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <CalendarClock className="size-6 text-primary" />
            <span className="text-lg font-semibold">Gestión Horarios</span>
          </div>
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Accede con tu cuenta para gestionar tus horarios.
            </p>
          </div>
          <Card>
            <CardContent className="pt-5">
              <Suspense>
                <LoginForm />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
