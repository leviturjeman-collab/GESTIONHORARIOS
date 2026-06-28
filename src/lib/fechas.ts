import {
  startOfWeek,
  addDays,
  addWeeks,
  format,
  parseISO,
  isSameDay,
} from "date-fns";
import { es } from "date-fns/locale";

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
  return `${format(lunes, "d MMM", { locale: es })} – ${format(domingo, "d MMM yyyy", {
    locale: es,
  })}`;
}

export function fechaCorta(d: Date): string {
  return format(d, "d MMM", { locale: es });
}
export function fechaLarga(d: Date): string {
  return format(d, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
}
export function horaTexto(d: Date): string {
  return format(d, "HH:mm");
}

export { isSameDay, format, addDays };
