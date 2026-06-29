import {
  startOfWeek,
  addDays,
  addWeeks,
  format,
  parseISO,
  isSameDay,
} from "date-fns";
import { es } from "date-fns/locale";

/** Formats a Date object to YYYY-MM-DD in Europe/Madrid timezone */
export function dateToISOLocal(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
}

/** Lunes (00:00) de la semana que contiene `fecha`. Semana europea (lunes). */
export function lunesDeSemana(fecha: Date = new Date()): Date {
  const d = startOfWeek(fecha, { weekStartsOn: 1 });
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Array con los 7 días (Date) de la semana que empieza en `lunes`. */
export function diasDeSemana(lunes: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(lunes, i));
}

export function semanaSiguiente(lunes: Date): Date {
  return addWeeks(lunes, 1);
}
export function semanaAnterior(lunes: Date): Date {
  return addWeeks(lunes, -1);
}

/** Clave estable de semana: "2026-W26" para selección por URL. */
export function claveSemana(lunes: Date): string {
  return format(lunes, "yyyy-MM-dd");
}

/** Parsea ?semana=yyyy-MM-dd; si no es válida, usa la semana actual. */
export function semanaDesdeParam(param?: string | null): Date {
  if (param) {
    try {
      return lunesDeSemana(parseISO(param));
    } catch {
      /* ignore */
    }
  }
  return lunesDeSemana();
}

export function rangoSemanaTexto(lunes: Date): string {
  const domingo = addDays(lunes, 6);
  const yearFormatter = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", year: "numeric" });
  return `${fechaCorta(lunes)} – ${fechaCorta(domingo)} ${yearFormatter.format(domingo)}`;
}

export function fechaCorta(d: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "numeric",
    month: "short"
  }).format(d);
}

export function fechaLarga(d: Date): string {
  const text = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(d);
  // 'lunes, 1 de enero de 2024' -> 'lunes 1 de enero de 2024' (if needed)
  return text.replace(",", "");
}

export function horaTexto(d: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(d);
}

export { isSameDay, format, addDays };
