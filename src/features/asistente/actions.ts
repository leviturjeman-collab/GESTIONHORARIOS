"use server";

import { prisma } from "@/lib/prisma";
import { requireSesion } from "@/lib/session";
import { esResponsable } from "@/lib/rbac";
import { lunesDeSemana, diasDeSemana } from "@/lib/fechas";
import { DIAS_SEMANA } from "@/lib/utils";
import { generarTexto, IA_ACTIVA } from "@/lib/ai/anthropic";

/** Construye el horario de la semana del empleado en texto (contexto + fallback). */
async function horarioEmpleadoTexto(empleadoId: string): Promise<string> {
  const lunes = lunesDeSemana();
  const dias = diasDeSemana(lunes);
  const turnos = await prisma.turno.findMany({
    where: { empleadoId, dia: { gte: lunes, lt: dias[6] }, cuadrante: { estado: { in: ["PUBLICADO", "BLOQUEADO"] } } },
    orderBy: { dia: "asc" },
  });
  if (turnos.length === 0) return "No tienes turnos publicados esta semana.";
  const lineas = dias.map((d, i) => {
    const delDia = turnos.filter((t) => sameDay(t.dia, d));
    if (delDia.length === 0) return `${DIAS_SEMANA[i]}: libre`;
    return `${DIAS_SEMANA[i]}: ${delDia.map((t) => `${t.horaInicio}–${t.horaFin}`).join(", ")}`;
  });
  return lineas.join("\n");
}

export async function preguntarAsistente(
  mensaje: string
): Promise<{ texto: string; modo: "ia" | "simulado" }> {
  const u = await requireSesion();
  const responsable = esResponsable(u);

  let contexto = "";
  if (u.empleadoId) {
    contexto = "Horario de esta semana del empleado:\n" + (await horarioEmpleadoTexto(u.empleadoId));
  } else if (responsable) {
    const [empleados, pendientes] = await Promise.all([
      prisma.empleado.count({ where: { organizacionId: u.organizacionId } }),
      prisma.ausencia.count({ where: { estado: "PENDIENTE", empleado: { organizacionId: u.organizacionId } } }),
    ]);
    contexto = `La organización tiene ${empleados} empleados y ${pendientes} solicitudes pendientes.`;
  }

  if (!IA_ACTIVA) {
    // Respuesta simulada (sin coste de API)
    const m = mensaje.toLowerCase();
    if (u.empleadoId && (m.includes("trabajo") || m.includes("horario") || m.includes("semana") || m.includes("turno"))) {
      return { texto: "Tu horario de esta semana:\n\n" + (await horarioEmpleadoTexto(u.empleadoId)), modo: "simulado" };
    }
    return {
      texto:
        "Estoy en modo simulado (sin clave de IA configurada). Puedo mostrarte tu horario de la semana si me lo pides. Para respuestas completas, configura ANTHROPIC_API_KEY.",
      modo: "simulado",
    };
  }

  const system = responsable
    ? "Eres el asistente de planificación de Gestión Horarios (hostelería). Ayudas al responsable a planificar y consultar datos. Responde en español, breve y concreto. La IA propone; el responsable confirma."
    : "Eres el asistente de Gestión Horarios para empleados de hostelería. Respondes en español sobre el horario del empleado, sus horas y cómo solicitar vacaciones o cambios de turno. Sé breve y amable.";

  const texto = await generarTexto(system, `${contexto}\n\nPregunta: ${mensaje}`, 700, {
    organizacionId: u.organizacionId,
    operacion: "ASISTENTE",
  });
  return { texto: texto ?? "No he podido generar una respuesta.", modo: "ia" };
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
