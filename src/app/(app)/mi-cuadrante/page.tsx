import { Clock } from "lucide-react";
import { requireSesion } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { lunesDeSemana, diasDeSemana, rangoSemanaTexto, isSameDay } from "@/lib/fechas";
import { DIAS_SEMANA } from "@/lib/utils";
import { horasTurno } from "@/lib/utils";
import { etiquetaRol, colorDeRol } from "@/lib/enums";
import { horas } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default async function MiCuadrantePage() {
  const usuario = await requireSesion();
  const lunes = lunesDeSemana();
  const dias = diasDeSemana(lunes);

  if (!usuario.empleadoId) {
    return (
      <EmptyState
        icon={Clock}
        titulo="Sin ficha de empleado"
        descripcion="Tu cuenta no está vinculada a una ficha de empleado. Contacta con tu responsable."
      />
    );
  }

  const turnos = await prisma.turno.findMany({
    where: {
      empleadoId: usuario.empleadoId,
      dia: { gte: lunes, lt: diasDeSemana(lunes)[6] },
      cuadrante: { estado: { in: ["PUBLICADO", "BLOQUEADO"] } },
    },
    orderBy: { dia: "asc" },
  });

  const totalHoras = turnos.reduce((acc, t) => acc + horasTurno(t), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Mi cuadrante"
        descripcion={`Semana ${rangoSemanaTexto(lunes)} · ${horas(totalHoras)} en total`}
      />

      {turnos.length === 0 ? (
        <EmptyState
          icon={Clock}
          titulo="No tienes turnos publicados esta semana"
          descripcion="Cuando tu responsable publique el cuadrante, verás aquí tus turnos."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {dias.map((dia, i) => {
            const delDia = turnos.filter((t) => isSameDay(new Date(t.dia), dia));
            return (
              <Card key={i} className="p-4">
                <p className="mb-2 text-sm font-semibold">{DIAS_SEMANA[i]}</p>
                {delDia.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Libre</p>
                ) : (
                  <div className="space-y-2">
                    {delDia.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-md border-l-4 bg-muted/40 px-3 py-2 text-sm"
                        style={{ borderColor: colorDeRol(t.rol) }}
                      >
                        <p className="font-medium">
                          {t.horaInicio}–{t.horaFin}
                          {t.partido && t.horaInicio2 ? ` · ${t.horaInicio2}–${t.horaFin2}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">{etiquetaRol(t.rol)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
