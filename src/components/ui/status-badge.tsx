import { Badge } from "@/components/ui/badge";

/**
 * Chip de estado semántico. Mapea los estados del dominio (solicitudes,
 * cuadrantes, cambios de turno, fichajes) a su color: verde = aprobado/ok,
 * ámbar = pendiente/aviso, rojo = rechazado/conflicto, gris = informativo.
 */
type Variante = "success" | "warning" | "danger" | "info" | "neutral" | "default";

const MAPA: Record<string, { label: string; variant: Variante }> = {
  // Cuadrante
  BORRADOR: { label: "Borrador", variant: "neutral" },
  PUBLICADO: { label: "Publicado", variant: "success" },
  BLOQUEADO: { label: "Bloqueado", variant: "info" },
  // Solicitudes
  PENDIENTE: { label: "Pendiente", variant: "warning" },
  APROBADA: { label: "Aprobada", variant: "success" },
  RECHAZADA: { label: "Rechazada", variant: "danger" },
  // Cambios de turno
  PROPUESTO: { label: "Propuesto", variant: "neutral" },
  ACEPTADO: { label: "Aceptado", variant: "info" },
  PENDIENTE_APROBACION: { label: "Pend. aprobación", variant: "warning" },
  CONFIRMADO: { label: "Confirmado", variant: "success" },
  RECHAZADO: { label: "Rechazado", variant: "danger" },
  // Empleado
  ACTIVO: { label: "Activo", variant: "success" },
  INVITADO: { label: "Invitado", variant: "warning" },
  INACTIVO: { label: "Inactivo", variant: "neutral" },
  // Fichaje
  ENTRADA_TARDE: { label: "Entrada tarde", variant: "warning" },
  SALIDA_TEMPRANA: { label: "Salida temprana", variant: "warning" },
  SIN_FICHAR: { label: "Sin fichar", variant: "danger" },
  FUERA_DE_RADIO: { label: "Fuera de radio", variant: "danger" },
};

export function StatusBadge({ estado }: { estado: string }) {
  const cfg = MAPA[estado] ?? { label: estado, variant: "neutral" as Variante };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
