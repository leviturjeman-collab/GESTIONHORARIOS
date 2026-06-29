import { redirect } from "next/navigation";
import { Cpu } from "lucide-react";
import { requireSesion } from "@/lib/session";
import { esResponsable, esAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { resumenUsoIA } from "@/lib/ai/uso";
import { euros } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { OnboardingWizard } from "@/features/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  const usuario = await requireSesion();
  if (!esResponsable(usuario)) redirect("/mi-cuadrante");

  // Datos de consumo del sistema
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const usos = await prisma.usoIA.findMany({
    where: { organizacionId: usuario.organizacionId },
    orderBy: { creadoEn: "desc" },
    take: 1000,
  });
  const resumen = resumenUsoIA(usos);
  const costeMes = usos.filter((u) => u.creadoEn >= inicioMes).reduce((a, u) => a + u.costeEur, 0);

  const ubicacionesExistentes = await prisma.ubicacion.findMany({
    where: { organizacionId: usuario.organizacionId },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" }
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        titulo="Insertar cuadrante actual"
        descripcion="Sube el cuadrante que ya usas. El sistema lo analiza, te hace unas preguntas y genera tu cuadrante mejorado."
      />
      <OnboardingWizard ubicacionesExistentes={ubicacionesExistentes} />

      {/* Panel de consumo del sistema */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="size-4 text-accent" /> Consumo del sistema
          </CardTitle>
          <CardDescription>
            Tokens y coste estimado de cada operación.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Coste este mes</p>
              <p className="text-2xl font-semibold tabular-nums">{euros(costeMes, true)}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Coste acumulado</p>
              <p className="text-2xl font-semibold tabular-nums">{euros(resumen.costeTotal, true)}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Llamadas totales</p>
              <p className="text-2xl font-semibold tabular-nums">{resumen.llamadasTotal}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2">Operación</th>
                  <th className="py-2">API key</th>
                  <th className="py-2">Modelo</th>
                  <th className="py-2 text-right">Llamadas</th>
                  <th className="py-2 text-right">Tokens</th>
                  <th className="py-2 text-right">Coste</th>
                </tr>
              </thead>
              <tbody>
                {resumen.filas.map((o) => (
                  <tr key={o.operacion} className="border-b last:border-0">
                    <td className="py-2">{o.etiquetaOperacion}</td>
                    <td className="py-2 text-xs text-muted-foreground">{o.etiquetaProveedor}</td>
                    <td className="py-2 font-mono text-xs text-muted-foreground">{o.modelo}</td>
                    <td className="py-2 text-right tabular-nums">{o.llamadas}</td>
                    <td className="py-2 text-right tabular-nums">{o.tokens.toLocaleString("es-ES")}</td>
                    <td className="py-2 text-right tabular-nums">
                      {o.coste > 0 ? euros(o.coste, true) : <span className="text-green-600">Gratis</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {resumen.llamadasTotal === 0 && (
            <p className="text-sm text-muted-foreground">
              Aún no se ha registrado consumo del sistema. Al analizar un archivo aparecerá
              aquí el modelo exacto usado (Claude o Gemini para el OCR) y su coste real.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            El OCR de imágenes usa Gemini Flash en la capa gratuita de Google AI
            (0&nbsp;€). El análisis, la generación y el asistente usan Claude.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
