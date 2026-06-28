import { requireSesion } from "@/lib/session";
import { esResponsable } from "@/lib/rbac";
import { IA_ACTIVA } from "@/lib/ai/anthropic";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Chat } from "@/features/asistente/chat";

export default async function AsistentePage() {
  const usuario = await requireSesion();
  const responsable = esResponsable(usuario);

  const sugerencias = responsable
    ? [
        "Genera la próxima semana respetando las vacaciones aprobadas",
        "¿Qué solicitudes tengo pendientes?",
        "Revisa el cuadrante y dime los problemas",
      ]
    : [
        "¿Cuándo trabajo esta semana?",
        "¿Cuántas horas llevo?",
        "¿Cómo pido vacaciones?",
      ];

  return (
    <div className="space-y-6">
      <PageHeader titulo="Asistente" descripcion="Planifica y consulta en lenguaje natural.">
        <Badge variant={IA_ACTIVA ? "success" : "warning"}>
          {IA_ACTIVA ? "Sistema activo" : "Modo simulado"}
        </Badge>
      </PageHeader>
      <Chat sugerencias={sugerencias} />
    </div>
  );
}
