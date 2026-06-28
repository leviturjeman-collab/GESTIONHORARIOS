"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSesion } from "@/lib/session";
import { fallo, requireResponsable, puedeUbicacion, type Resultado } from "@/lib/guards";
import { minutosDeHora } from "@/lib/utils";
import { dentroDelRadio } from "@/lib/geo";
import { notificarAdmins } from "@/lib/notificaciones";

export type FicharOpts = { lat?: number; lng?: number; empleadoId?: string };

function hoy() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function turnoDeHoy(empleadoId: string) {
  const inicio = hoy();
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 1);
  return prisma.turno.findFirst({
    where: { empleadoId, dia: { gte: inicio, lt: fin } },
    orderBy: { horaInicio: "asc" },
  });
}

/**
 * Verifica la proximidad al local. Si el local tiene coordenadas y el empleado
 * está fuera del radio (o no comparte ubicación), devuelve el motivo para
 * BLOQUEAR el fichaje y avisa al administrador del intento.
 */
async function verificarProximidad(
  empleadoId: string,
  organizacionId: string,
  pos: { lat?: number; lng?: number }
): Promise<{ ok: true; dentro: boolean | null } | { ok: false; error: string }> {
  const emp = await prisma.empleado.findUnique({
    where: { id: empleadoId },
    select: { nombre: true, apellidos: true, ubicacion: { select: { nombre: true, lat: true, lng: true, radioFichajeMetros: true } } },
  });
  const ubic = emp?.ubicacion;
  if (!ubic) return { ok: true, dentro: null };

  const geo = dentroDelRadio(ubic, pos);
  if (geo.verificable && !geo.dentro) {
    await notificarAdmins(organizacionId, {
      tipo: "INCIDENCIA_FICHAJE",
      titulo: "Intento de fichaje fuera de radio",
      cuerpo: `${emp?.nombre ?? "Un empleado"} ${emp?.apellidos ?? ""} ha intentado fichar fuera del radio de ${ubic.nombre}${geo.distancia != null ? ` (a ${geo.distancia} m)` : " (sin compartir ubicación)"}.`,
      enlace: "/fichaje",
    });
    const motivo =
      geo.distancia != null
        ? `Estás a ${geo.distancia} m del local. Debes estar a menos de ${ubic.radioFichajeMetros} m para fichar.`
        : "No hemos podido obtener tu ubicación. Activa la geolocalización para fichar.";
    return { ok: false, error: motivo };
  }
  return { ok: true, dentro: geo.verificable ? geo.dentro : null };
}

/** Ficha entrada (verificando proximidad). Detecta entrada tarde. */
export async function ficharEntrada(opts: FicharOpts = {}): Promise<Resultado> {
  const u = await requireSesion();
  const empleadoId = opts.empleadoId ?? u.empleadoId;
  if (!empleadoId) return fallo("Sin ficha de empleado");

  const abierto = await prisma.fichaje.findFirst({ where: { empleadoId, salida: null } });
  if (abierto) return fallo("Ya tienes un fichaje abierto");

  const prox = await verificarProximidad(empleadoId, u.organizacionId, opts);
  if (!prox.ok) return fallo(prox.error);

  const turno = await turnoDeHoy(empleadoId);
  let incidencia: string | null = null;
  if (turno) {
    const ahora = new Date();
    const minNow = ahora.getHours() * 60 + ahora.getMinutes();
    if (minNow > minutosDeHora(turno.horaInicio) + 10) incidencia = "ENTRADA_TARDE";
  }

  await prisma.fichaje.create({
    data: {
      empleadoId,
      turnoId: turno?.id ?? null,
      entrada: new Date(),
      lat: opts.lat ?? null,
      lng: opts.lng ?? null,
      dentroDeRadio: prox.dentro,
      incidencia,
    },
  });

  if (incidencia) {
    const emp = await prisma.empleado.findUnique({ where: { id: empleadoId }, select: { nombre: true, apellidos: true } });
    await notificarAdmins(u.organizacionId, {
      tipo: "INCIDENCIA_FICHAJE",
      titulo: "Incidencia de fichaje",
      cuerpo: `${emp?.nombre ?? "Un empleado"} ${emp?.apellidos ?? ""} ha fichado tarde.`,
      enlace: "/fichaje",
    });
  }
  revalidatePath("/fichar");
  revalidatePath("/fichaje");
  return { ok: true };
}

/** Ficha salida (verificando proximidad). Detecta salida temprana. */
export async function ficharSalida(opts: FicharOpts = {}): Promise<Resultado> {
  const u = await requireSesion();
  const empleadoId = opts.empleadoId ?? u.empleadoId;
  if (!empleadoId) return fallo("Sin ficha de empleado");

  const abierto = await prisma.fichaje.findFirst({
    where: { empleadoId, salida: null },
    orderBy: { entrada: "desc" },
    include: { turno: true },
  });
  if (!abierto) return fallo("No tienes ningún fichaje abierto");

  const prox = await verificarProximidad(empleadoId, u.organizacionId, opts);
  if (!prox.ok) return fallo(prox.error);

  let incidencia = abierto.incidencia;
  if (abierto.turno) {
    const ahora = new Date();
    const minNow = ahora.getHours() * 60 + ahora.getMinutes();
    if (minNow < minutosDeHora(abierto.turno.horaFin) - 10 && !incidencia)
      incidencia = "SALIDA_TEMPRANA";
  }

  await prisma.fichaje.update({
    where: { id: abierto.id },
    data: { salida: new Date(), incidencia, lat: opts.lat ?? abierto.lat, lng: opts.lng ?? abierto.lng },
  });
  revalidatePath("/fichar");
  revalidatePath("/fichaje");
  return { ok: true };
}

/**
 * Corrige un fichaje (responsable) conservando el dato original (auditoría/RGPD).
 * Requiere una justificación.
 */
export async function corregirFichaje(
  fichajeId: string,
  raw: {
    entradaHora?: string;
    salidaHora?: string;
    entradaFecha?: string;
    salidaFecha?: string;
    motivo?: string;
  }
): Promise<Resultado> {
  const u = await requireResponsable();
  const reHora = /^([01]\d|2[0-3]):[0-5]\d$/;
  const reFecha = /^\d{4}-\d{2}-\d{2}$/;
  const motivo = (raw.motivo ?? "").trim();
  if (!motivo) return fallo("Indica el motivo de la corrección");
  if (!raw.entradaHora || !reHora.test(raw.entradaHora)) return fallo("Hora de entrada no válida (HH:mm)");
  if (raw.salidaHora && !reHora.test(raw.salidaHora)) return fallo("Hora de salida no válida (HH:mm)");

  const f = await prisma.fichaje.findUnique({
    where: { id: fichajeId },
    include: { empleado: { select: { ubicacionId: true } } },
  });
  if (!f) return fallo("Fichaje no encontrado");
  if (!f.empleado.ubicacionId || !(await puedeUbicacion(u, f.empleado.ubicacionId)))
    return fallo("No permitido");

  // Si no se envían fechas, usamos la fecha local original del fichaje
  // Usar format y/o fecha local en la zona Europe/Madrid
  const toLocalDateString = (d: Date) => {
    // Obtenemos año, mes, día locales
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const originalEntradaFecha = toLocalDateString(f.entrada);
  const originalSalidaFecha = f.salida ? toLocalDateString(f.salida) : originalEntradaFecha;

  const entFecha = raw.entradaFecha && reFecha.test(raw.entradaFecha) ? raw.entradaFecha : originalEntradaFecha;
  const salFecha = raw.salidaFecha && reFecha.test(raw.salidaFecha) ? raw.salidaFecha : originalSalidaFecha;

  const combineFechaHora = (fechaStr: string, horaStr: string) => {
    const [y, m, d] = fechaStr.split("-").map(Number);
    const [h, min] = horaStr.split(":").map(Number);
    return new Date(y, m - 1, d, h, min, 0, 0);
  };

  const nuevaEntrada = combineFechaHora(entFecha, raw.entradaHora);
  const nuevaSalida = raw.salidaHora ? combineFechaHora(salFecha, raw.salidaHora) : f.salida;

  // Conserva SIEMPRE el primer dato original; no se sobrescribe en correcciones sucesivas.
  const datosOriginales =
    f.corregido && f.datosOriginales
      ? f.datosOriginales
      : JSON.stringify({ entrada: f.entrada, salida: f.salida, incidencia: f.incidencia, motivo });

  await prisma.fichaje.update({
    where: { id: fichajeId },
    data: {
      entrada: nuevaEntrada,
      salida: nuevaSalida,
      corregido: true,
      corregidoPorId: u.id,
      datosOriginales,
    },
  });
  revalidatePath("/fichaje");
  return { ok: true };
}

export async function crearFichajeManual(
  empleadoId: string,
  raw: {
    entradaHora: string;
    entradaFecha: string;
    salidaHora: string;
    salidaFecha: string;
    motivo: string;
  }
): Promise<Resultado> {
  const u = await requireResponsable();
  const reHora = /^([01]\d|2[0-3]):[0-5]\d$/;
  const reFecha = /^\d{4}-\d{2}-\d{2}$/;
  const motivo = (raw.motivo ?? "").trim();
  if (!motivo) return fallo("Indica el motivo del fichaje manual");
  if (!raw.entradaHora || !reHora.test(raw.entradaHora)) return fallo("Hora de entrada no válida (HH:mm)");
  if (!raw.entradaFecha || !reFecha.test(raw.entradaFecha)) return fallo("Fecha de entrada no válida (YYYY-MM-DD)");
  if (raw.salidaHora && !reHora.test(raw.salidaHora)) return fallo("Hora de salida no válida (HH:mm)");

  const combineFechaHora = (fechaStr: string, horaStr: string) => {
    const [y, m, d] = fechaStr.split("-").map(Number);
    const [h, min] = horaStr.split(":").map(Number);
    return new Date(y, m - 1, d, h, min, 0, 0);
  };

  const entrada = combineFechaHora(raw.entradaFecha, raw.entradaHora);
  const salida = raw.salidaHora ? combineFechaHora(raw.salidaFecha || raw.entradaFecha, raw.salidaHora) : null;

  // Encontrar el turno correspondiente del empleado para ese día de entrada
  const inicioDia = new Date(entrada);
  inicioDia.setHours(0, 0, 0, 0);
  const finDia = new Date(inicioDia);
  finDia.setDate(finDia.getDate() + 1);

  const turno = await prisma.turno.findFirst({
    where: { empleadoId, dia: { gte: inicioDia, lt: finDia } },
  });

  await prisma.fichaje.create({
    data: {
      empleadoId,
      turnoId: turno?.id ?? null,
      entrada,
      salida,
      corregido: true,
      corregidoPorId: u.id,
      datosOriginales: JSON.stringify({ manual: true, motivo }),
    },
  });

  revalidatePath("/fichaje");
  return { ok: true };
}
