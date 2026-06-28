import { redirect } from "next/navigation";
import { Sparkles, Mail, Building2, CheckCircle2, AlertTriangle, Cpu } from "lucide-react";
import { requireSesion, resolverAmbito } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { esResponsable, esAdmin } from "@/lib/rbac";
import { IA_ACTIVA } from "@/lib/ai/anthropic";
import { resumenUsoIA } from "@/lib/ai/uso";
import { EMAIL_ACTIVO } from "@/lib/email";
import { euros } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { RuleToggle } from "@/features/ajustes/rule-toggle";

export default async function AjustesPage({
  searchParams,
}: {
  searchParams: { ubicacion?: string };
}) {
  const usuario = await requireSesion();
  if (!esResponsable(usuario)) redirect("/mi-cuadrante");
  const ambito = await resolverAmbito(usuario, searchParams.ubicacion);

  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [org, ubicaciones, usos] = await Promise.all([
    prisma.organizacion.findUnique({ where: { id: usuario.organizacionId } }),
    prisma.ubicacion.findMany({ where: { id: { in: ambito } }, orderBy: { nombre: "asc" } }),
    prisma.usoIA.findMany({
      where: { organizacionId: usuario.organizacionId },
      orderBy: { creadoEn: "desc" },
      take: 1000,
    }),
  ]);

  // Agregados de consumo del sistema: modelo real por operación, agrupado por API key.
  const resumen = resumenUsoIA(usos);
  const costeMes = usos.filter((u) => u.creadoEn >= inicioMes).reduce((a, u) => a + u.costeEur, 0);

  const Estado = ({ ok }: { ok: boolean }) =>
    ok ? (
      <span className="flex items-center gap-1 text-sm text-success">
        <CheckCircle2 className="size-4" /> Configurado
      </span>
    ) : (
      <span className="flex items-center gap-1 text-sm text-warning-foreground">
        <AlertTriangle className="size-4" /> Sin configurar (modo simulado)
      </span>
    );

  return (
    <div className="space-y-6">
      <PageHeader titulo="Ajustes" descripcion="Configuración de la organización y reglas." />

      {esAdmin(usuario) && (
        <Card>
          <CardHeader>
            <CardTitle>Organización</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              <span className="text-muted-foreground">Nombre:</span>{" "}
              <span className="font-medium">{org?.nombre}</span>
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-4" /> Reglas por ubicación
          </CardTitle>
          <CardDescription>
            Los cambios de turno requieren aprobación del responsable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {ubicaciones.map((u) => (
              <li key={u.id} className="flex items-center justify-between py-3">
                <span className="text-sm font-medium">{u.nombre}</span>
                <RuleToggle ubicacionId={u.id} inicial={u.requiereAprobacionCambios} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {esAdmin(usuario) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="size-4 text-accent" /> Consumo del sistema
            </CardTitle>
            <CardDescription>
              Tokens y coste estimado de cada operación. Modelo configurable por entorno.
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

            {/* Coste por API key (proveedor) */}
            {resumen.totalesProveedor.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {resumen.totalesProveedor.map((t) => (
                  <div key={t.proveedor} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{t.etiqueta}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.llamadas} llamadas · {t.tokens.toLocaleString("es-ES")} tokens
                      </p>
                    </div>
                    <p className="text-lg font-semibold tabular-nums">
                      {t.coste > 0 ? euros(t.coste, true) : "Gratis"}
                    </p>
                  </div>
                ))}
              </div>
            )}

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
                        {o.coste > 0 ? euros(o.coste, true) : "Gratis"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {resumen.llamadasTotal === 0 && (
              <p className="text-sm text-muted-foreground">
                Aún no se ha registrado consumo del sistema. Las llamadas reales (análisis,
                generación, detección, asistente y OCR) aparecerán aquí con el modelo
                exacto y su coste.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {esAdmin(usuario) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-accent" /> Inteligencia artificial
              </CardTitle>
              <CardDescription>Clave de Anthropic (ANTHROPIC_API_KEY).</CardDescription>
            </CardHeader>
            <CardContent>
              <Estado ok={IA_ACTIVA} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="size-4" /> Correo
              </CardTitle>
              <CardDescription>Envío de avisos (Resend).</CardDescription>
            </CardHeader>
            <CardContent>
              <Estado ok={EMAIL_ACTIVO} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
