import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Iniciales de una persona para el avatar. */
export function iniciales(nombre: string, apellidos?: string | null): string {
  const a = (nombre?.trim()?.[0] ?? "").toUpperCase();
  const b = (apellidos?.trim()?.[0] ?? nombre?.trim()?.split(" ")?.[1]?.[0] ?? "")
    .toString()
    .toUpperCase();
  return (a + b) || "?";
}

const fmtEUR = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const fmtEUR2 = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

export function euros(n: number, decimales = false): string {
  return (decimales ? fmtEUR2 : fmtEUR).format(Number.isFinite(n) ? n : 0);
}

export function horas(n: number): string {
  const v = Math.round((n + Number.EPSILON) * 10) / 10;
  return `${v.toLocaleString("es-ES")} h`;
}

/** "HH:mm" -> minutos desde medianoche. */
export function minutosDeHora(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}

/** Duración en horas de un tramo "HH:mm"–"HH:mm" (admite turnos que cruzan medianoche). */
export function duracionHoras(inicio: string, fin: string): number {
  let mins = minutosDeHora(fin) - minutosDeHora(inicio);
  if (mins < 0) mins += 24 * 60; // turno nocturno
  return mins / 60;
}

/** Horas totales de un turno (tramo 1 + tramo 2 si es partido) menos descanso. */
export function horasTurno(t: {
  horaInicio: string;
  horaFin: string;
  horaInicio2?: string | null;
  horaFin2?: string | null;
  descansoMin?: number | null;
}): number {
  let total = duracionHoras(t.horaInicio, t.horaFin);
  if (t.horaInicio2 && t.horaFin2) {
    total += duracionHoras(t.horaInicio2, t.horaFin2);
  }
  total -= (t.descansoMin ?? 0) / 60;
  return Math.max(0, total);
}

export const DIAS_SEMANA = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

export const DIAS_SEMANA_CORTO = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;
