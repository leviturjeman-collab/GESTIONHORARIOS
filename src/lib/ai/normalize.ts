/**
 * Post-procesamiento determinista de resultados de análisis de cuadrantes.
 * 100% agnóstico de industria.
 *
 * Pipeline:
 * 1. deduplicarNombres   → Levenshtein + claveIdentidad
 * 2. normalizarHorarios  → "6"→"06:00", "02C"→"02:00"
 * 3. recalcularHoras     → suma real desde turnos
 * 4. inferirTipoContrato → ≥35h=COMPLETO
 */

import type { EmpleadoDetectado, ResultadoAnalisis } from "./onboarding";

// ════════════════ Utilidades de texto ════════════════

/** Normaliza: sin acentos, lowercase, sin puntuación */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.*(),"]/g, "")
    .trim();
}

/**
 * Distancia de edición entre dos strings (inserciones, borrados, sustituciones).
 *
 * Ejemplos:
 *   levenshtein("franyelis", "franyelys") → 1
 *   levenshtein("asiz", "aziz")           → 1
 *   levenshtein("antonio", "nelson")      → 5
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  // Optimización: si la diferencia de longitud > 2, no pueden ser ≤2
  if (Math.abs(m - n) > 2) return Math.abs(m - n);

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 +
            Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Extrae la "clave de identidad" para comparación.
 * Quita iniciales de apellido sueltas, normaliza.
 *
 *   "Antonio M."     → "antonio"
 *   "María G."       → "maria"
 *   "Ana Sofía"      → "ana sofia"
 */
export function claveIdentidad(nombre: string): string {
  return norm(nombre)
    .replace(/\b[a-z]\.\s*/g, "") // quita "M.", "G.", "P."
    .replace(/\b[a-z]\s*$/g, "") // quita inicial suelta al final sin punto
    .replace(/\s+/g, " ")
    .trim();
}

/** Devuelve el nombre más "completo" (más largo, sin iniciales) */
function nombreMasCompleto(a: string, b: string): string {
  const aCompleto = !a.includes(".") && a.split(" ").length > 1;
  const bCompleto = !b.includes(".") && b.split(" ").length > 1;
  if (aCompleto && !bCompleto) return a;
  if (bCompleto && !aCompleto) return b;
  return a.length >= b.length ? a : b;
}

// ════════════════ 1. Deduplicación ════════════════

/**
 * Agrupa empleados que son la misma persona bajo nombres distintos.
 *
 * Algoritmo Union-Find con 3 reglas de matching:
 *   REGLA 1 — Clave idéntica (ej: "Antonio M." y "Antonio" → clave "antonio")
 *   REGLA 2 — Primer nombre igual + Levenshtein total ≤ 2
 *   REGLA 3 — Levenshtein de clave ≤ 1 (solo nombres ≥ 4 chars)
 *
 * Fusión: nombre más completo, turnos concatenados, confianza más alta.
 */
export function deduplicarNombres(
  emps: EmpleadoDetectado[]
): EmpleadoDetectado[] {
  if (emps.length <= 1) return emps;

  const grupo: number[] = emps.map((_, i) => i);
  function find(i: number): number {
    while (grupo[i] !== i) i = grupo[i];
    return i;
  }
  function union(i: number, j: number) {
    grupo[find(j)] = find(i);
  }

  for (let i = 0; i < emps.length; i++) {
    for (let j = i + 1; j < emps.length; j++) {
      if (find(i) === find(j)) continue;

      const ci = claveIdentidad(emps[i].nombre);
      const cj = claveIdentidad(emps[j].nombre);

      // REGLA 1: clave idéntica
      if (ci === cj) {
        union(i, j);
        continue;
      }

      // REGLA 2: primer nombre idéntico (≥3 chars) + Levenshtein completo ≤ 2
      const pi = ci.split(" ")[0];
      const pj = cj.split(" ")[0];
      if (pi === pj && pi.length >= 3 && levenshtein(ci, cj) <= 2) {
        union(i, j);
        continue;
      }

      // REGLA 3: Levenshtein de clave ≤ 1 (solo si ambos ≥ 4 chars)
      if (ci.length >= 4 && cj.length >= 4 && levenshtein(ci, cj) <= 1) {
        union(i, j);
      }
    }
  }

  // Agrupar y fusionar
  const grupos = new Map<number, EmpleadoDetectado[]>();
  for (let i = 0; i < emps.length; i++) {
    const rep = find(i);
    if (!grupos.has(rep)) grupos.set(rep, []);
    grupos.get(rep)!.push(emps[i]);
  }

  return Array.from(grupos.values()).map((miembros) => {
    if (miembros.length === 1) return miembros[0];

    const base = { ...miembros[0] };

    // Nombre: el más completo de todos los miembros
    for (const m of miembros.slice(1)) {
      base.nombre = nombreMasCompleto(base.nombre, m.nombre);
    }

    // Turnos: concatenar sin duplicar por diaIdx
    const turnosMap = new Map<
      number,
      NonNullable<typeof base.turnos>[number]
    >();
    for (const m of miembros) {
      for (const t of m.turnos || []) {
        if (!turnosMap.has(t.diaIdx)) turnosMap.set(t.diaIdx, t);
      }
    }
    base.turnos = Array.from(turnosMap.values()).sort(
      (a, b) => a.diaIdx - b.diaIdx
    );

    // Horas: tomar del miembro con confianza "alta"
    const mejorH = miembros.find(
      (m) => m.confianza.horasSemana === "alta"
    );
    if (mejorH) {
      base.horasSemana = mejorH.horasSemana;
      base.confianza.horasSemana = "alta";
    }

    // Rol: tomar del miembro con confianza "alta"
    const mejorR = miembros.find((m) => m.confianza.rol === "alta");
    if (mejorR) {
      base.rol = mejorR.rol;
      base.confianza.rol = "alta";
    }

    return base;
  });
}

// ════════════════ 2. Normalización de horarios ════════════════

/**
 * Normaliza un string de hora a formato "HH:mm".
 *
 *   normHora("6")     → "06:00"
 *   normHora("23")    → "23:00"
 *   normHora("02C")   → "02:00"
 *   normHora("14:30") → "14:30"
 */
export function normHora(h: string | undefined): string | undefined {
  if (!h) return undefined;
  const limpio = h.replace(/[Cc]$/, "").trim();
  if (/^\d{1,2}$/.test(limpio)) {
    return limpio.padStart(2, "0") + ":00";
  }
  if (/^\d{1,2}:\d{1,2}$/.test(limpio)) {
    const [hh, mm] = limpio.split(":");
    return hh.padStart(2, "0") + ":" + mm.padStart(2, "0");
  }
  return limpio;
}

/**
 * Calcula las horas de duración de un turno.
 * Maneja turnos nocturnos automáticamente (fin < inicio → cruza medianoche).
 *
 *   horasTurno("11:00", "17:00") → 6
 *   horasTurno("20:00", "02:00") → 6
 *   horasTurno("19:00", "03:00") → 8
 */
export function horasTurno(inicio: string, fin: string): number {
  const [hi, mi] = inicio.split(":").map(Number);
  const [hf, mf] = fin.split(":").map(Number);
  let minI = hi * 60 + (mi || 0);
  let minF = hf * 60 + (mf || 0);
  if (minF <= minI) minF += 24 * 60; // cruza medianoche
  return (minF - minI) / 60;
}

function normalizarHorarios(
  emps: EmpleadoDetectado[]
): EmpleadoDetectado[] {
  return emps.map((emp) => ({
    ...emp,
    turnos: (emp.turnos || []).map((t) => ({
      ...t,
      horaInicio: normHora(t.horaInicio) || t.horaInicio,
      horaFin: normHora(t.horaFin) || t.horaFin,
      horaInicio2: normHora(t.horaInicio2),
      horaFin2: normHora(t.horaFin2),
    })),
  }));
}

// ════════════════ 3. Recalcular horas semanales ════════════════

/**
 * Si el empleado tiene turnos extraídos, recalcula horasSemana sumándolos.
 * Solo sobreescribe si la confianza actual NO es "alta".
 */
function recalcularHoras(emps: EmpleadoDetectado[]): EmpleadoDetectado[] {
  return emps.map((emp) => {
    const turnos = emp.turnos || [];
    if (turnos.length === 0) return emp;

    let total = 0;
    for (const t of turnos) {
      if (t.horaInicio && t.horaFin) total += horasTurno(t.horaInicio, t.horaFin);
      if (t.partido && t.horaInicio2 && t.horaFin2)
        total += horasTurno(t.horaInicio2, t.horaFin2);
    }

    if (total > 0 && total <= 80 && emp.confianza.horasSemana !== "alta") {
      return {
        ...emp,
        horasSemana: Math.round(total),
        confianza: { ...emp.confianza, horasSemana: "alta" },
      };
    }
    return emp;
  });
}

// ════════════════ 4. Inferir tipo contrato ════════════════

function inferirTipoContrato(
  emps: EmpleadoDetectado[]
): EmpleadoDetectado[] {
  return emps.map((emp) =>
    emp.confianza.tipo === "alta"
      ? emp
      : { ...emp, tipo: emp.horasSemana >= 35 ? "COMPLETO" : "PARCIAL" }
  );
}

// ════════════════ Pipeline principal ════════════════

export function postProcesarResultado(
  res: ResultadoAnalisis
): ResultadoAnalisis {
  let empleados = res.empleados;
  empleados = deduplicarNombres(empleados);
  empleados = normalizarHorarios(empleados);
  empleados = recalcularHoras(empleados);
  empleados = inferirTipoContrato(empleados);
  return { ...res, empleados };
}
