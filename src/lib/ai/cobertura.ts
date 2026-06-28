/**
 * Análisis de cobertura por rol y franja horaria.
 *
 * A partir de los turnos extraídos de cada empleado, computa:
 * 1. Mapa de cobertura: cuántas personas de cada rol trabajan en cada hora de cada día
 * 2. Detección de franjas naturales del negocio
 * 3. Resumen por rol: mínimos, máximos y promedios
 * 4. Preguntas inteligentes basadas en los datos reales
 *
 * Este módulo NO llama a la IA — es 100% cálculo local (coste = €0).
 */

import type { EmpleadoDetectado, PreguntaIA } from "./onboarding";

// ─────────── Tipos ───────────

/** Cobertura por hora: para un rol concreto, cuánta gente hay cada hora */
export type CoberturaHoraria = {
  /** [día 0-6][hora 0-23] = número de personas trabajando */
  matriz: number[][];
};

/** Resumen de cobertura de un rol */
export type ResumenRol = {
  rol: string;
  totalEmpleados: number;
  horasContratoPromedio: number;
  cobertura: CoberturaHoraria;
  /** Franja de mayor cobertura (ej: "12:00-16:00") */
  franjaMaxima: { inicio: string; fin: string; personas: number };
  /** Franja de menor cobertura (excluyendo horas sin nadie) */
  franjaMinima: {
    inicio: string;
    fin: string;
    personas: number;
  } | null;
  /** Personas en hora punta por día [0-6] */
  picosPorDia: number[];
};

/** Resultado completo del análisis de cobertura */
export type AnalisisCobertura = {
  roles: ResumenRol[];
  horaAperturaDetectada: string;
  horaCierreDetectada: string;
  diasConMasPersonal: number[];
  diasConMenosPersonal: number[];
  preguntas: PreguntaIA[];
};

// ─────────── Cálculo de cobertura ───────────

/** Convierte "HH:mm" a minutos desde medianoche. */
function aMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * Marca las horas ocupadas en la matriz para un turno concreto.
 *
 * Ejemplo: turno 11:00-17:00 → marca horas 11, 12, 13, 14, 15, 16
 *          turno 20:00-02:00 → marca horas 20, 21, 22, 23 y día+1: 0, 1
 */
function marcarTurno(
  matriz: number[][],
  diaIdx: number,
  horaInicio: string,
  horaFin: string
): void {
  if (diaIdx < 0 || diaIdx > 6) return;

  let minI = aMinutos(horaInicio);
  let minF = aMinutos(horaFin);
  // Turno nocturno: fin < inicio → cruza medianoche
  if (minF <= minI) minF += 24 * 60;

  // Marcar cada hora completa cubierta
  for (let m = minI; m < minF; m += 60) {
    const hora = Math.floor(m / 60) % 24;
    const dia = m >= 24 * 60 ? (diaIdx + 1) % 7 : diaIdx;
    matriz[dia][hora]++;
  }
}

/** Formatea una hora numérica a "HH:00" */
function fmtHora(h: number): string {
  return String(h).padStart(2, "0") + ":00";
}

/**
 * Calcula el mapa de cobertura completo a partir de los empleados y sus turnos.
 */
export function calcularCobertura(
  empleados: EmpleadoDetectado[]
): AnalisisCobertura {
  // Agrupar por rol
  const porRol = new Map<string, EmpleadoDetectado[]>();
  for (const emp of empleados) {
    const rol = emp.rol || "sin_rol";
    if (!porRol.has(rol)) porRol.set(rol, []);
    porRol.get(rol)!.push(emp);
  }

  const roles: ResumenRol[] = [];
  let primeraHoraGlobal = 23;
  let ultimaHoraGlobal = 0;
  const personalTotalPorDia = Array(7).fill(0) as number[];

  for (const [rol, emps] of porRol) {
    // Crear matriz 7 días × 24 horas, inicializada en 0
    const matriz: number[][] = Array.from({ length: 7 }, () =>
      Array(24).fill(0)
    );

    // Rellenar la matriz con los turnos
    for (const emp of emps) {
      for (const t of emp.turnos || []) {
        if (!t.horaInicio || !t.horaFin) continue;
        marcarTurno(matriz, t.diaIdx, t.horaInicio, t.horaFin);
        // Segundo tramo si turno partido
        if (t.partido && t.horaInicio2 && t.horaFin2) {
          marcarTurno(matriz, t.diaIdx, t.horaInicio2, t.horaFin2);
        }
      }
    }

    // Encontrar franjas de máxima y mínima cobertura
    let maxPersonas = 0,
      maxHora = 0;
    let minPersonas = Infinity,
      minHora = -1;
    const picosPorDia: number[] = [];

    for (let d = 0; d < 7; d++) {
      let picoDia = 0;
      for (let h = 0; h < 24; h++) {
        const n = matriz[d][h];
        if (n > picoDia) picoDia = n;
        if (n > maxPersonas) {
          maxPersonas = n;
          maxHora = h;
        }
        if (n > 0 && n < minPersonas) {
          minPersonas = n;
          minHora = h;
        }
        // Tracking global
        if (n > 0) {
          if (h < primeraHoraGlobal) primeraHoraGlobal = h;
          if (h > ultimaHoraGlobal) ultimaHoraGlobal = h;
        }
      }
      picosPorDia.push(picoDia);
      personalTotalPorDia[d] += picoDia;
    }

    const horasContratoPromedio =
      emps.reduce((s, e) => s + e.horasSemana, 0) / emps.length;

    roles.push({
      rol,
      totalEmpleados: emps.length,
      horasContratoPromedio: Math.round(horasContratoPromedio),
      cobertura: { matriz },
      franjaMaxima: {
        inicio: fmtHora(maxHora),
        fin: fmtHora(maxHora + 1),
        personas: maxPersonas,
      },
      franjaMinima:
        minHora >= 0
          ? {
              inicio: fmtHora(minHora),
              fin: fmtHora(minHora + 1),
              personas: minPersonas === Infinity ? 0 : minPersonas,
            }
          : null,
      picosPorDia,
    });
  }

  // Días con más y menos personal
  const maxPersonalDia = Math.max(...personalTotalPorDia);
  const minPersonalDia = Math.min(
    ...personalTotalPorDia.filter((n) => n > 0)
  );
  const diasConMas = personalTotalPorDia
    .map((n, i) => (n === maxPersonalDia ? i : -1))
    .filter((i) => i >= 0);
  const diasConMenos = personalTotalPorDia
    .map((n, i) => (n === minPersonalDia && n > 0 ? i : -1))
    .filter((i) => i >= 0);

  // Generar preguntas inteligentes
  const preguntas = generarPreguntasInteligentes(roles, {
    horaApertura: fmtHora(primeraHoraGlobal),
    horaCierre: fmtHora(ultimaHoraGlobal + 1),
    diasPico: diasConMas,
  });

  return {
    roles,
    horaAperturaDetectada: fmtHora(primeraHoraGlobal),
    horaCierreDetectada: fmtHora(ultimaHoraGlobal + 1),
    diasConMasPersonal: diasConMas,
    diasConMenosPersonal: diasConMenos,
    preguntas,
  };
}

// ─────────── Preguntas inteligentes ───────────

const DIAS = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
];

/**
 * Genera preguntas contextuales basadas en los datos REALES del cuadrante.
 * No son preguntas genéricas: mencionan números concretos y patrones detectados.
 */
function generarPreguntasInteligentes(
  roles: ResumenRol[],
  ctx: { horaApertura: string; horaCierre: string; diasPico: number[] }
): PreguntaIA[] {
  const preguntas: PreguntaIA[] = [];

  // ── 1. Horario comercial (límites absolutos para la IA) ──
  preguntas.push({
    pregunta:
      `El horario más amplio detectado en los turnos es de ${ctx.horaApertura} a ${ctx.horaCierre}. ` +
      `Para que no se asignen turnos fuera de hora, ¿es este el horario de actividad real del local (desde que entra el primero hasta que sale el último)?`,
    opciones: [
      `Sí, de ${ctx.horaApertura} a ${ctx.horaCierre} todos los días`,
      "El horario cambia según el día (ej. fines de semana cerramos más tarde)",
      "Es diferente (configurar manualmente)",
    ],
  });

  // ── 2. Día de cierre semanal ──
  const diasSinNadie: number[] = [];
  for (let d = 0; d < 7; d++) {
    const alguien = roles.some((r) => r.cobertura.matriz[d].some((h) => h > 0));
    if (!alguien) diasSinNadie.push(d);
  }

  if (diasSinNadie.length > 0) {
    const diasStr = diasSinNadie.map((d) => DIAS[d]).join(" y ");
    preguntas.push({
      pregunta: `He detectado que el ${diasStr} no hay turnos. ¿El sistema debe dejar ese día vacío por cierre del negocio?`,
      opciones: [
        `Sí, cerramos el ${diasStr} (nadie trabaja)`,
        "No, ese día abrimos pero faltaba en el documento",
        "Los días de cierre son otros",
      ],
    });
  } else {
    preguntas.push({
      pregunta: "¿El negocio cierra algún día completo de la semana en el que no se deba asignar ningún turno?",
      opciones: [
        "No, abrimos de lunes a domingo",
        "Lunes",
        "Domingo",
        "Configurar días de cierre manualmente",
      ],
    });
  }

  // ── 3. Tipología de turnos ──
  preguntas.push({
    pregunta:
      "¿Cuál es la estructura habitual para los empleados a jornada completa?",
    opciones: [
      "8 horas seguidas (turno continuo)",
      "Turno partido (ej. 4h mañana + 4h tarde)",
      "Mezcla de turnos continuos y partidos según necesidad",
      "Configurar manualmente",
    ],
  });

  // ── 3.5 Preparación y Limpieza ──
  preguntas.push({
    pregunta:
      "¿El personal de limpieza o preparación (office) necesita entrar a trabajar antes de la hora oficial de apertura?",
    opciones: [
      "Limpieza y office entran 1 hora antes de abrir",
      "Limpieza y office entran 2 horas antes de abrir",
      "Limpieza y office entran a la misma hora de apertura",
      "Configurar manualmente",
    ],
  });

  // ── 4. Matriz de Cobertura / Curva de Demanda ──
  preguntas.push({
    pregunta:
      "¿Cómo prefieres definir cuánta gente hace falta en cada momento del día (ej. 'de 14:00 a 17:00 necesito 3 cocineros')?",
    opciones: [
      "Quiero configurar una curva de demanda por franjas horarias (Recomendado)",
      "Usar el patrón de mi cuadrante actual (el sistema imitará lo que ya hago)",
      "Tengo el mismo volumen de trabajo todo el día (cobertura plana)",
    ],
  });

  // ── 5. Días punta (Refuerzo de plantilla) ──
  if (ctx.diasPico.length > 0 && ctx.diasPico.length < 7) {
    const diasPicoStr = ctx.diasPico.map((d) => DIAS[d]).join(" y ");
    preguntas.push({
      pregunta:
        `He detectado que ${diasPicoStr} son los días con más empleados simultáneos. ` +
        `¿El sistema debe asegurar siempre un refuerzo de plantilla esos días?`,
      opciones: [
        `Sí, ${diasPicoStr} requieren más personal`,
        "No, la demanda es igual todos los días",
        "Configurar los días fuertes manualmente",
      ],
    });
  }

  // ── 6. Descanso Semanal (Libranzas) ──
  preguntas.push({
    pregunta:
      "¿Cómo prefieres que se asignen los días libres (descanso semanal)?",
    opciones: [
      "2 días libres seguidos (recomendado)",
      "1.5 días libres seguidos (mínimo legal)",
      "2 días libres pero pueden ser separados si es necesario",
      "Configurar manualmente por empleado",
    ],
  });

  // ── 7. Fatiga: Máximo de días consecutivos ──
  preguntas.push({
    pregunta:
      "¿Cuántos días seguidos puede trabajar un empleado como máximo antes de su descanso?",
    opciones: [
      "5 días seguidos (estándar)",
      "6 días seguidos (máximo legal en España)",
      "4 días seguidos",
    ],
  });

  // ── 8. Descanso diario entre turnos ──
  preguntas.push({
    pregunta:
      "¿Cuántas horas de descanso mínimo se deben asegurar entre el fin del turno de un día y el inicio del siguiente?",
    opciones: [
      "12 horas (legal en España)",
      "10 horas (hostelería flexible / convenio específico)",
      "8 horas (solo casos excepcionales)",
    ],
  });

  // ── 9. Flexibilidad de roles (Polivalencia) ──
  if (roles.length > 1) {
    const nombresRoles = roles.map((r) => r.rol).join(", ");
    preguntas.push({
      pregunta:
        `Tienes empleados en ${roles.length} roles (${nombresRoles}). ` +
        `Si falta personal en un rol, ¿se puede asignar temporalmente a un empleado de otro rol?`,
      opciones: [
        "No, se debe respetar estrictamente el rol de cada uno",
        "Sí, algunos son polivalentes (configuraré quiénes después)",
        "Sí, todos pueden cubrir cualquier rol",
      ],
    });
  }

  // ── 10. Pausas durante el turno (Comida/Descanso) ──
  preguntas.push({
    pregunta:
      "En turnos largos (más de 6 horas), ¿cómo se gestionan las pausas para descanso o comida?",
    opciones: [
      "30 minutos de descanso pagado (computa como trabajo)",
      "1 hora de descanso no pagado (el turno se alarga 1h)",
      "Se turnan informalmente sin afectar la planificación oficial",
      "Configurar manualmente por empleado",
    ],
  });

  // ── 11. Restricciones de horario (Turnos fijos) ──
  preguntas.push({
    pregunta:
      "¿Hay empleados con disponibilidad limitada (estudiantes, conciliación familiar, etc.)?",
    opciones: [
      "No, todos tienen disponibilidad total para cualquier turno",
      "Sí, algunos empleados tienen horarios restringidos",
      "La mayoría tienen un turno fijo asignado",
    ],
  });

  // ── 12. Equidad en turnos difíciles (Rotación justa) ──
  preguntas.push({
    pregunta:
      "¿Prefieres que se repartan los turnos 'difíciles' (cierres, fines de semana, festivos) equitativamente entre toda la plantilla?",
    opciones: [
      "Sí, rotación 100% justa y equilibrada",
      "No, hay empleados contratados específicamente para esos turnos",
      "Configurar manualmente las preferencias de rotación",
    ],
  });

  // ── 13. Duración MÍNIMA de un turno ──
  preguntas.push({
    pregunta:
      "¿Cuál es el mínimo de horas que se puede asignar a un turno suelto?",
    opciones: [
      "4 horas mínimo",
      "3 horas mínimo",
      "2 horas mínimo (ej. refuerzos puntuales)",
      "Sin límite mínimo",
    ],
  });

  // ── 14. Límite MÁXIMO de horas diarias ──
  preguntas.push({
    pregunta:
      "Aparte del límite semanal del contrato, ¿cuál es el máximo de horas que un empleado puede trabajar en un solo día?",
    opciones: [
      "8 horas máximo",
      "9 horas máximo (distribución irregular)",
      "Hasta 12 horas (con turnos partidos y descansos largos)",
    ],
  });

  // ── 15. Seniority / Responsabilidad ──
  preguntas.push({
    pregunta:
      "¿Debe asegurarse de que siempre haya al menos un empleado 'Veterano' o 'Encargado' presente en cada franja horaria?",
    opciones: [
      "Sí, es obligatorio al menos 1 por turno",
      "Es preferible pero no obligatorio",
      "No hace falta controlar la experiencia por turno",
    ],
  });

  return preguntas;
}

