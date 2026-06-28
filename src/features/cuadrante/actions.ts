"use server";

import { revalidatePath } from "next/cache";
import { parseISO } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireResponsable, puedeUbicacion, fallo, type Resultado } from "@/lib/guards";
import { turnoSchema } from "@/lib/validators/turno";
import { getOrCreateCuadrante } from "@/lib/cuadrante";
import { lunesDeSemana, diasDeSemana } from "@/lib/fechas";
import { detectarProblemas, type Problema } from "@/lib/detector";
import { generarTurnosIA, type TurnoPropuesto, type ContextoGeneracion } from "@/lib/ai/cuadrante";
import { notificarAdmins, notificarUsuario } from "@/lib/notificaciones";
import { colorDeRol } from "@/lib/enums";

async function asegurarAcceso(ubicacionId: string) {
  const u = await requireResponsable();
  if (!(await puedeUbicacion(u, ubicacionId))) throw new Error("Ubicación no permitida");
  return u;
}

function diaDesde(diaISO: string): Date {
  const d = parseISO(diaISO);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function guardarRespuestasCalibracion(
  ubicacionId: string,
  input: {
    respuestas: Record<string, string>;
    curvaDemanda: any;
    subRespuestas: any;
  }
): Promise<Resultado> {
  const u = await asegurarAcceso(ubicacionId);
  const org = await prisma.organizacion.findUnique({ where: { id: u.organizacionId } });
  const ajustes = JSON.parse(org?.ajustes || "{}");
  
  ajustes.respuestasOnboarding = input.respuestas;
  // Borramos las preguntas generadas porque ya se han respondido
  delete ajustes.preguntasOnboarding;
  
  await prisma.organizacion.update({
    where: { id: u.organizacionId },
    data: { ajustes: JSON.stringify(ajustes) },
  });

  return { ok: true };
}

export async function crearTurno(
  ubicacionId: string,
  semanaISO: string,
  raw: unknown
): Promise<Resultado> {
  await asegurarAcceso(ubicacionId);
  const parsed = turnoSchema.safeParse(raw);
  if (!parsed.success) return fallo(parsed.error.errors[0]?.message ?? "Datos no válidos");
  const d = parsed.data;
  const lunes = lunesDeSemana(parseISO(semanaISO));
  const cuad = await getOrCreateCuadrante(ubicacionId, lunes);
  if (cuad.estado === "BLOQUEADO") return fallo("La semana está bloqueada");

  await prisma.turno.create({
    data: {
      cuadranteId: cuad.id,
      empleadoId: d.empleadoId,
      dia: diaDesde(d.diaISO),
      horaInicio: d.horaInicio,
      horaFin: d.horaFin,
      rol: d.rol,
      partido: d.partido && !!d.horaInicio2 && !!d.horaFin2,
      horaInicio2: d.partido ? d.horaInicio2 || null : null,
      horaFin2: d.partido ? d.horaFin2 || null : null,
      descansoMin: d.descansoMin,
      notas: d.notas || null,
    },
  });
  revalidatePath("/cuadrantes");
  return { ok: true };
}

export async function actualizarTurno(turnoId: string, raw: unknown): Promise<Resultado> {
  const u = await requireResponsable();
  const turno = await prisma.turno.findUnique({
    where: { id: turnoId },
    include: { cuadrante: true },
  });
  if (!turno) return fallo("Turno no encontrado");
  if (!(await puedeUbicacion(u, turno.cuadrante.ubicacionId))) return fallo("No permitido");
  const parsed = turnoSchema.safeParse(raw);
  if (!parsed.success) return fallo(parsed.error.errors[0]?.message ?? "Datos no válidos");
  const d = parsed.data;

  await prisma.turno.update({
    where: { id: turnoId },
    data: {
      empleadoId: d.empleadoId,
      dia: diaDesde(d.diaISO),
      horaInicio: d.horaInicio,
      horaFin: d.horaFin,
      rol: d.rol,
      partido: d.partido && !!d.horaInicio2 && !!d.horaFin2,
      horaInicio2: d.partido ? d.horaInicio2 || null : null,
      horaFin2: d.partido ? d.horaFin2 || null : null,
      descansoMin: d.descansoMin,
      notas: d.notas || null,
    },
  });
  revalidatePath("/cuadrantes");
  return { ok: true };
}

export async function eliminarTurno(turnoId: string): Promise<Resultado> {
  const u = await requireResponsable();
  const turno = await prisma.turno.findUnique({
    where: { id: turnoId },
    include: { cuadrante: true },
  });
  if (!turno) return fallo("Turno no encontrado");
  if (!(await puedeUbicacion(u, turno.cuadrante.ubicacionId))) return fallo("No permitido");
  await prisma.turno.delete({ where: { id: turnoId } });
  revalidatePath("/cuadrantes");
  return { ok: true };
}

/** Mueve un turno a otro empleado y/o día (drag & drop). */
export async function moverTurno(
  turnoId: string,
  empleadoId: string,
  diaISO: string
): Promise<Resultado> {
  const u = await requireResponsable();
  const turno = await prisma.turno.findUnique({
    where: { id: turnoId },
    include: { cuadrante: true },
  });
  if (!turno) return fallo("Turno no encontrado");
  if (!(await puedeUbicacion(u, turno.cuadrante.ubicacionId))) return fallo("No permitido");
  if (turno.cuadrante.estado === "BLOQUEADO") return fallo("La semana está bloqueada");
  await prisma.turno.update({
    where: { id: turnoId },
    data: { empleadoId, dia: diaDesde(diaISO) },
  });
  revalidatePath("/cuadrantes");
  return { ok: true };
}

export async function publicarCuadrante(
  ubicacionId: string,
  semanaISO: string
): Promise<Resultado> {
  const u = await asegurarAcceso(ubicacionId);
  const lunes = lunesDeSemana(parseISO(semanaISO));
  const cuad = await getOrCreateCuadrante(ubicacionId, lunes);
  await prisma.cuadrante.update({
    where: { id: cuad.id },
    data: { estado: "PUBLICADO", publicadoEn: new Date(), autorId: u.id },
  });
  const ubic = await prisma.ubicacion.findUnique({ where: { id: ubicacionId }, select: { nombre: true } });
  await notificarAdmins(u.organizacionId, {
    tipo: "CUADRANTE_PUBLICADO",
    titulo: "Cuadrante publicado",
    cuerpo: `${ubic?.nombre ?? "Una ubicación"} ha publicado el cuadrante de la semana.`,
    enlace: "/cuadrantes",
  });

  // Aviso in-app a cada empleado con cuenta de la ubicación.
  const empleados = await prisma.empleado.findMany({
    where: { ubicacionId, usuarioId: { not: null } },
    select: { usuarioId: true },
  });
  await Promise.all(
    empleados.map((e) =>
      notificarUsuario(u.organizacionId, e.usuarioId!, {
        tipo: "CUADRANTE_PUBLICADO",
        titulo: "Tu cuadrante ya está publicado",
        cuerpo: "Consulta tu horario de la semana.",
        enlace: "/mi-cuadrante",
      })
    )
  );
  revalidatePath("/cuadrantes");
  return { ok: true };
}

/** Construye el contexto y genera una PROPUESTA (no la aplica). */
export async function generarPreviewIA(
  ubicacionId: string,
  semanaISO: string,
  instruccion: string
): Promise<Resultado<{ turnos: TurnoPropuesto[]; resumen: string; modo: string }>> {
  const u = await asegurarAcceso(ubicacionId);
  const lunes = lunesDeSemana(parseISO(semanaISO));
  const dias = diasDeSemana(lunes);

  const [empleados, reglas, ubic, disponibilidades, ausencias, org] = await Promise.all([
    prisma.empleado.findMany({
      where: { ubicacionId, estado: "ACTIVO" },
      include: { contrato: true },
    }),
    prisma.coberturaMinima.findMany({ where: { ubicacionId } }),
    prisma.ubicacion.findUnique({ where: { id: ubicacionId } }),
    prisma.disponibilidad.findMany({
      where: { empleado: { ubicacionId } },
    }),
    prisma.ausencia.findMany({
      where: {
        empleado: { ubicacionId },
        estado: "APROBADA",
        fechaInicio: { lte: dias[6] },
        fechaFin: { gte: dias[0] },
      },
    }),
    prisma.organizacion.findUnique({
      where: { id: u.organizacionId },
    }),
  ]);

  const ubicAjustes = ubic?.ajustes ? JSON.parse(ubic.ajustes) : {};
  const orgAjustes = JSON.parse(org?.ajustes || "{}");
  
  const rolesPartido = (ubicAjustes.rolesTurnoPartido || orgAjustes.rolesTurnoPartido || []) as string[];
  const horarioCustom = ubicAjustes.horarioCustom || orgAjustes.horarioCustom || null;
  const diasCierre = (horarioCustom?.diasCierre || []) as number[];

  const ctx: ContextoGeneracion = {
    horaApertura: ubic?.horaApertura ?? "09:00",
    horaCierre: ubic?.horaCierre ?? "23:00",
    reglas: reglas.map((r) => ({
      rol: r.rol,
      franjaInicio: r.franjaInicio,
      franjaFin: r.franjaFin,
      minPersonas: r.minPersonas,
    })),
    empleados: empleados.map((e) => {
      const noDisp = new Set<number>();
      for (const d of disponibilidades.filter((x) => x.empleadoId === e.id && x.estado === "NO_DISPONIBLE" && x.activa !== false)) {
        if (d.diaSemana != null) noDisp.add(d.diaSemana);
      }
      for (const a of ausencias.filter((x) => x.empleadoId === e.id)) {
        dias.forEach((dia, idx) => {
          if (dia >= startDay(a.fechaInicio) && dia <= a.fechaFin) noDisp.add(idx);
        });
      }
      // Agregar los días de cierre de la ubicación
      for (const dc of diasCierre) {
        noDisp.add(dc);
      }

      const empRestricciones: string[] = [];

      // Inject contract preferences and split shift rules
      if (e.contrato?.preferenciaTurno && e.contrato.preferenciaTurno !== "INDIFERENTE") {
        empRestricciones.push(`Preferencia de turno: ${e.contrato.preferenciaTurno.toLowerCase()}`);
      }
      if (e.contrato?.permitePartido === false) {
        empRestricciones.push(`No tiene permitido realizar turnos partidos (doble turno diario). Todos sus turnos deben ser continuos.`);
      }
      if (e.contrato?.admiteHorasExtra === false) {
        empRestricciones.push(`NO admite horas extras bajo ninguna circunstancia. No se le deben asignar turnos que superen su jornada de contrato.`);
      }

      const empDisponibilidades = disponibilidades.filter((x) => x.empleadoId === e.id && x.activa !== false);
      const DIAS_NOMBRES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
      for (const d of empDisponibilidades) {
        const diaNombre = d.diaSemana !== null && d.diaSemana !== undefined ? DIAS_NOMBRES[d.diaSemana] : null;
        if (d.estado === "NO_DISPONIBLE") {
          if (diaNombre) {
            empRestricciones.push(`No disponible los ${diaNombre.toLowerCase()}s`);
          } else if (d.fecha) {
            empRestricciones.push(`No disponible el día ${d.fecha.toLocaleDateString('es-ES')}`);
          }
          if (d.franjaInicio !== "00:00" || d.franjaFin !== "23:59") {
            empRestricciones.push(`No disponible en la franja de ${d.franjaInicio} a ${d.franjaFin}`);
          }
          if (d.notas) {
            empRestricciones.push(d.notas);
          }
        } else if (d.estado === "PREFIERE_NO") {
          if (diaNombre) {
            empRestricciones.push(`Prefiere no trabajar los ${diaNombre.toLowerCase()}s`);
          }
          if (d.franjaInicio !== "00:00" || d.franjaFin !== "23:59") {
            empRestricciones.push(`Prefiere no trabajar en la franja de ${d.franjaInicio} a ${d.franjaFin}`);
          }
          if (d.notas) {
            empRestricciones.push(`Preferencia: ${d.notas}`);
          }
        }
      }

      return {
        id: e.id,
        nombre: `${e.nombre} ${e.apellidos ?? ""}`.trim(),
        rol: e.rolFuncional,
        tipo: e.contrato?.tipo ?? "INDEFINIDO_COMPLETO",
        horasContrato: e.contrato?.horasSemana ?? 40,
        diasDescanso: e.contrato?.diasDescanso ?? 2,
        diasNoDisponibles: [...noDisp],
        restricciones: empRestricciones,
      };
    }),
  };

  let instruccionFinal = "";
  if (rolesPartido.length > 0) {
    instruccionFinal += `REGLA DE TURNO PARTIDO: Solo los empleados con roles [${rolesPartido.join(", ")}] pueden hacer turnos partidos. Para los demás roles, todos los turnos deben ser continuos (partido=false).\n`;
  } else {
    instruccionFinal += `REGLA DE TURNO PARTIDO: Ningún empleado puede hacer turnos partidos (todos los turnos deben ser continuos, partido=false).\n`;
  }

  if (horarioCustom) {
    if (horarioCustom.diferenteFinSemana) {
      instruccionFinal += `REGLA DE HORARIOS: De lunes a viernes el local abre de ${horarioCustom.aperturaSemana} a ${horarioCustom.cierreSemana}. Sábados (5) y domingos (6) el local abre de ${horarioCustom.aperturaFinSemana} a ${horarioCustom.cierreFinSemana}. Ajusta los turnos en consecuencia.\n`;
    } else {
      instruccionFinal += `REGLA DE HORARIOS: El local abre de ${horarioCustom.aperturaSemana} a ${horarioCustom.cierreSemana} todos los días de la semana.\n`;
    }
    if (diasCierre.length > 0) {
      const nombresDias = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
      const diasStr = diasCierre.map((d: number) => nombresDias[d]).join(", ");
      instruccionFinal += `REGLA DE CIERRE SEMANAL: El local está CERRADO los días [${diasStr}]. No asignes ningún turno en esos días para ningún empleado.\n`;
    }
  }

  const respuestasOnboarding = ubicAjustes.respuestasOnboarding || orgAjustes.respuestasOnboarding || {};
  if (Object.keys(respuestasOnboarding).length > 0) {
    instruccionFinal += "\nREGLAS ADICIONALES DEL LOCAL Y REQUISITOS DEL GERENTE:\n";
    Object.entries(respuestasOnboarding).forEach(([key, val]) => {
      if (typeof val === "string" && val.trim() !== "") {
         if (key.endsWith("_manual_txt")) {
           instruccionFinal += `- NOTA DEL GERENTE: ${val}\n`;
         } else if (key.includes("_empdetail_")) {
           const empNameRaw = key.split("_empdetail_")[1];
           const empName = empNameRaw.replace("_btn", "").replace("_txt", "");
           instruccionFinal += `- REGLA PARA EMPLEADO (${empName}): ${val}\n`;
         } else if (key.includes("_roldetail_")) {
           const rolNameRaw = key.split("_roldetail_")[1];
           const rolName = rolNameRaw.replace("_btn", "").replace("_txt", "");
           instruccionFinal += `- REGLA PARA ROL (${rolName}): ${val}\n`;
         } else if (!key.includes("_") && val !== "Otro (especificar)") {
           instruccionFinal += `- PREFERENCIA: ${val}\n`;
         }
      }
    });
  }

  instruccionFinal += `\nInstrucción del responsable: "${instruccion || "Genera la semana de forma equilibrada."}"`;

  const res = await generarTurnosIA(ctx, instruccionFinal, {
    organizacionId: u.organizacionId,
    ubicacionId,
    operacion: "GENERACION",
  });
  return { ok: true, data: res };
}

/** Aplica una propuesta: reemplaza los turnos del cuadrante (reversible regenerando). */
export async function aplicarPreviewIA(
  ubicacionId: string,
  semanaISO: string,
  turnos: TurnoPropuesto[]
): Promise<Resultado> {
  await asegurarAcceso(ubicacionId);
  const lunes = lunesDeSemana(parseISO(semanaISO));
  const dias = diasDeSemana(lunes);
  const cuad = await getOrCreateCuadrante(ubicacionId, lunes);
  if (cuad.estado === "BLOQUEADO") return fallo("La semana está bloqueada");

  // Snapshot de los turnos actuales para poder DESHACER (no destructivo).
  const actuales = await prisma.turno.findMany({ where: { cuadranteId: cuad.id } });
  const snapshot = JSON.stringify(
    actuales.map((t) => ({
      empleadoId: t.empleadoId,
      diaIdx: Math.round((startDay(t.dia).getTime() - lunes.getTime()) / 86400000),
      horaInicio: t.horaInicio,
      horaFin: t.horaFin,
      rol: t.rol,
      partido: t.partido,
      horaInicio2: t.horaInicio2,
      horaFin2: t.horaFin2,
      descansoMin: t.descansoMin,
    }))
  );

  await prisma.$transaction([
    prisma.cuadrante.update({
      where: { id: cuad.id },
      data: { snapshotAnterior: snapshot, origen: "GENERADO_IA" },
    }),
    prisma.turno.deleteMany({ where: { cuadranteId: cuad.id } }),
    ...turnos
      .filter((t) => t.diaIdx >= 0 && t.diaIdx <= 6)
      .map((t) =>
        prisma.turno.create({
          data: {
            cuadranteId: cuad.id,
            empleadoId: t.empleadoId,
            dia: dias[t.diaIdx],
            horaInicio: t.horaInicio,
            horaFin: t.horaFin,
            rol: t.rol,
            partido: !!t.partido && !!t.horaInicio2 && !!t.horaFin2,
            horaInicio2: t.horaInicio2 || null,
            horaFin2: t.horaFin2 || null,
          },
        })
      ),
  ]);
  revalidatePath("/cuadrantes");
  return { ok: true };
}

/** Deshace la última aplicación de la IA restaurando el snapshot guardado. */
export async function deshacerGeneracion(
  ubicacionId: string,
  semanaISO: string
): Promise<Resultado> {
  await asegurarAcceso(ubicacionId);
  const lunes = lunesDeSemana(parseISO(semanaISO));
  const dias = diasDeSemana(lunes);
  const cuad = await prisma.cuadrante.findUnique({
    where: { ubicacionId_semanaInicio: { ubicacionId, semanaInicio: lunes } },
  });
  if (!cuad || !cuad.snapshotAnterior) return fallo("No hay ninguna generación que deshacer");
  if (cuad.estado === "BLOQUEADO") return fallo("La semana está bloqueada");

  const prev: any[] = JSON.parse(cuad.snapshotAnterior);
  await prisma.$transaction([
    prisma.turno.deleteMany({ where: { cuadranteId: cuad.id } }),
    ...prev
      .filter((t) => t.diaIdx >= 0 && t.diaIdx <= 6)
      .map((t) =>
        prisma.turno.create({
          data: {
            cuadranteId: cuad.id,
            empleadoId: t.empleadoId,
            dia: dias[t.diaIdx],
            horaInicio: t.horaInicio,
            horaFin: t.horaFin,
            rol: t.rol,
            partido: t.partido,
            horaInicio2: t.horaInicio2,
            horaFin2: t.horaFin2,
            descansoMin: t.descansoMin ?? 0,
          },
        })
      ),
    prisma.cuadrante.update({ where: { id: cuad.id }, data: { snapshotAnterior: null } }),
  ]);
  revalidatePath("/cuadrantes");
  return { ok: true };
}

/** Ejecuta el detector sobre una PROPUESTA (sin aplicarla) para validarla antes. */
export async function validarPropuesta(
  ubicacionId: string,
  semanaISO: string,
  turnos: TurnoPropuesto[]
): Promise<Resultado<Problema[]>> {
  await asegurarAcceso(ubicacionId);
  const lunes = lunesDeSemana(parseISO(semanaISO));
  const dias = diasDeSemana(lunes);
  const [empleados, reglas, ausencias] = await Promise.all([
    prisma.empleado.findMany({ where: { ubicacionId }, include: { contrato: true } }),
    prisma.coberturaMinima.findMany({ where: { ubicacionId } }),
    prisma.ausencia.findMany({ where: { empleado: { ubicacionId }, estado: "APROBADA" } }),
  ]);
  const problemas = detectarProblemas({
    turnos: turnos
      .filter((t) => t.diaIdx >= 0 && t.diaIdx <= 6)
      .map((t, i) => ({
        id: String(i),
        empleadoId: t.empleadoId,
        dia: dias[t.diaIdx],
        horaInicio: t.horaInicio,
        horaFin: t.horaFin,
        horaInicio2: t.horaInicio2 ?? null,
        horaFin2: t.horaFin2 ?? null,
        rol: t.rol,
      })),
    empleados: empleados.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      apellidos: e.apellidos,
      horasContrato: e.contrato?.horasSemana ?? 40,
    })),
    reglas: reglas.map((r) => ({
      rol: r.rol,
      diaSemana: r.diaSemana,
      franjaInicio: r.franjaInicio,
      franjaFin: r.franjaFin,
      minPersonas: r.minPersonas,
    })),
    dias,
    ausencias: ausencias.map((a) => ({
      empleadoId: a.empleadoId,
      fechaInicio: a.fechaInicio,
      fechaFin: a.fechaFin,
    })),
  });
  return { ok: true, data: problemas };
}

export async function detectarProblemasAction(
  ubicacionId: string,
  semanaISO: string
): Promise<Resultado<Problema[]>> {
  await asegurarAcceso(ubicacionId);
  const lunes = lunesDeSemana(parseISO(semanaISO));
  const dias = diasDeSemana(lunes);
  const cuad = await prisma.cuadrante.findUnique({
    where: { ubicacionId_semanaInicio: { ubicacionId, semanaInicio: lunes } },
    include: { turnos: true },
  });
  const [empleados, reglas, ausencias] = await Promise.all([
    prisma.empleado.findMany({ where: { ubicacionId }, include: { contrato: true } }),
    prisma.coberturaMinima.findMany({ where: { ubicacionId } }),
    prisma.ausencia.findMany({ where: { empleado: { ubicacionId }, estado: "APROBADA" } }),
  ]);

  const problemas = detectarProblemas({
    turnos: (cuad?.turnos ?? []).map((t) => ({ ...t, dia: t.dia })),
    empleados: empleados.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      apellidos: e.apellidos,
      horasContrato: e.contrato?.horasSemana ?? 40,
    })),
    reglas: reglas.map((r) => ({
      rol: r.rol,
      diaSemana: r.diaSemana,
      franjaInicio: r.franjaInicio,
      franjaFin: r.franjaFin,
      minPersonas: r.minPersonas,
    })),
    dias,
    ausencias: ausencias.map((a) => ({
      empleadoId: a.empleadoId,
      fechaInicio: a.fechaInicio,
      fechaFin: a.fechaFin,
    })),
  });
  return { ok: true, data: problemas };
}

// ── Plantillas recurrentes ──

export async function guardarPlantilla(
  ubicacionId: string,
  semanaISO: string,
  nombre: string
): Promise<Resultado> {
  await asegurarAcceso(ubicacionId);
  if (!nombre.trim()) return fallo("Pon un nombre a la plantilla");
  const lunes = lunesDeSemana(parseISO(semanaISO));
  const cuad = await prisma.cuadrante.findUnique({
    where: { ubicacionId_semanaInicio: { ubicacionId, semanaInicio: lunes } },
    include: { turnos: true },
  });
  if (!cuad || cuad.turnos.length === 0) return fallo("No hay turnos que guardar");

  // Guarda el patrón relativo (diaIdx) sin fechas absolutas.
  const datos = cuad.turnos.map((t) => ({
    empleadoId: t.empleadoId,
    diaIdx: Math.round((t.dia.getTime() - lunes.getTime()) / 86400000),
    rol: t.rol,
    horaInicio: t.horaInicio,
    horaFin: t.horaFin,
    partido: t.partido,
    horaInicio2: t.horaInicio2,
    horaFin2: t.horaFin2,
    descansoMin: t.descansoMin,
  }));
  await prisma.plantilla.create({
    data: { ubicacionId, nombre: nombre.trim(), datos: JSON.stringify(datos) },
  });
  revalidatePath("/cuadrantes");
  return { ok: true };
}

export async function aplicarPlantilla(
  ubicacionId: string,
  semanaISO: string,
  plantillaId: string
): Promise<Resultado> {
  await asegurarAcceso(ubicacionId);
  const lunes = lunesDeSemana(parseISO(semanaISO));
  const dias = diasDeSemana(lunes);
  const plantilla = await prisma.plantilla.findFirst({ where: { id: plantillaId, ubicacionId } });
  if (!plantilla) return fallo("Plantilla no encontrada");
  const cuad = await getOrCreateCuadrante(ubicacionId, lunes);
  if (cuad.estado === "BLOQUEADO") return fallo("La semana está bloqueada");

  const datos: any[] = JSON.parse(plantilla.datos);

  // Empleados con ausencia aprobada esa semana → se omiten esos días.
  const ausencias = await prisma.ausencia.findMany({
    where: {
      empleado: { ubicacionId },
      estado: "APROBADA",
      fechaInicio: { lte: dias[6] },
      fechaFin: { gte: dias[0] },
    },
  });
  const bloqueado = (empId: string, idx: number) =>
    ausencias.some(
      (a) => a.empleadoId === empId && dias[idx] >= startDay(a.fechaInicio) && dias[idx] <= a.fechaFin
    );

  await prisma.$transaction([
    prisma.turno.deleteMany({ where: { cuadranteId: cuad.id } }),
    ...datos
      .filter((t) => t.diaIdx >= 0 && t.diaIdx <= 6 && !bloqueado(t.empleadoId, t.diaIdx))
      .map((t) =>
        prisma.turno.create({
          data: {
            cuadranteId: cuad.id,
            empleadoId: t.empleadoId,
            dia: dias[t.diaIdx],
            horaInicio: t.horaInicio,
            horaFin: t.horaFin,
            rol: t.rol,
            partido: t.partido,
            horaInicio2: t.horaInicio2,
            horaFin2: t.horaFin2,
            descansoMin: t.descansoMin ?? 0,
          },
        })
      ),
  ]);
  revalidatePath("/cuadrantes");
  return { ok: true };
}

export async function eliminarPlantilla(
  ubicacionId: string,
  plantillaId: string
): Promise<Resultado> {
  await asegurarAcceso(ubicacionId);
  const plantilla = await prisma.plantilla.findFirst({ where: { id: plantillaId, ubicacionId } });
  if (!plantilla) return fallo("Plantilla no encontrada");
  await prisma.plantilla.delete({ where: { id: plantillaId } });
  revalidatePath("/cuadrantes");
  return { ok: true };
}

export async function guardarCalibracion(
  ubicacionId: string,
  input: {
    horarioCustom: any;
    rolesTurnoPartido: string[];
  }
): Promise<Resultado> {
  await asegurarAcceso(ubicacionId);
  const ubic = await prisma.ubicacion.findUnique({ where: { id: ubicacionId } });
  if (!ubic) return fallo("Ubicación no encontrada");

  const ajustes = ubic.ajustes ? JSON.parse(ubic.ajustes) : {};
  ajustes.horarioCustom = input.horarioCustom;
  ajustes.rolesTurnoPartido = input.rolesTurnoPartido;

  await prisma.ubicacion.update({
    where: { id: ubicacionId },
    data: {
      horaApertura: input.horarioCustom?.aperturaSemana || ubic.horaApertura,
      horaCierre: input.horarioCustom?.cierreSemana || ubic.horaCierre,
      ajustes: JSON.stringify(ajustes),
    },
  });
  
  revalidatePath("/cuadrantes");
  return { ok: true };
}

export async function eliminarDisponibilidad(
  ubicacionId: string,
  disponibilidadId: string
): Promise<Resultado> {
  await asegurarAcceso(ubicacionId);
  const disp = await prisma.disponibilidad.findUnique({
    where: { id: disponibilidadId },
    include: { empleado: { select: { ubicacionId: true } } },
  });
  if (!disp || disp.empleado.ubicacionId !== ubicacionId) return fallo("No encontrado");

  await prisma.disponibilidad.delete({ where: { id: disponibilidadId } });
  revalidatePath("/cuadrantes");
  return { ok: true };
}

export async function crearDisponibilidadAction(
  ubicacionId: string,
  empleadoId: string,
  input: {
    diaSemana?: number;
    estado: string;
    franjaInicio?: string;
    franjaFin?: string;
    notas?: string;
  }
): Promise<Resultado> {
  await asegurarAcceso(ubicacionId);
  const emp = await prisma.empleado.findUnique({ where: { id: empleadoId } });
  if (!emp || emp.ubicacionId !== ubicacionId) return fallo("Empleado no encontrado");

  await prisma.disponibilidad.create({
    data: {
      empleadoId,
      recurrente: input.diaSemana !== undefined,
      diaSemana: input.diaSemana ?? null,
      estado: input.estado,
      franjaInicio: input.franjaInicio || "00:00",
      franjaFin: input.franjaFin || "23:59",
      notas: input.notas || null,
    },
  });
  revalidatePath("/cuadrantes");
  return { ok: true };
}

export async function actualizarContratoDescansos(
  ubicacionId: string,
  empleadoId: string,
  diasDescanso: number
): Promise<Resultado> {
  await asegurarAcceso(ubicacionId);
  const emp = await prisma.empleado.findUnique({
    where: { id: empleadoId },
    include: { contrato: true },
  });
  if (!emp || emp.ubicacionId !== ubicacionId) return fallo("Empleado no encontrado");

  if (emp.contrato) {
    await prisma.contrato.update({
      where: { id: emp.contrato.id },
      data: { diasDescanso },
    });
  } else {
    await prisma.contrato.create({
      data: { empleadoId, diasDescanso },
    });
  }
  revalidatePath("/cuadrantes");
  revalidatePath("/empleados");
  return { ok: true };
}

export async function actualizarEmpleadoCompleto(
  ubicacionId: string,
  empleadoId: string,
  data: {
    nombre: string;
    apellidos: string | null;
    rolFuncional: string;
    tipoContrato: string;
    horasSemana: number;
    diasDescanso: number;
    preferenciaTurno: string;
    permitePartido: boolean;
    admiteHorasExtra: boolean;
  }
): Promise<Resultado> {
  await asegurarAcceso(ubicacionId);
  const emp = await prisma.empleado.findUnique({
    where: { id: empleadoId },
    include: { contrato: true },
  });
  if (!emp || emp.ubicacionId !== ubicacionId) return fallo("Empleado no encontrado");

  await prisma.empleado.update({
    where: { id: empleadoId },
    data: {
      nombre: data.nombre,
      apellidos: data.apellidos,
      rolFuncional: data.rolFuncional,
      color: colorDeRol(data.rolFuncional),
      contrato: {
        upsert: {
          create: {
            tipo: data.tipoContrato,
            horasSemana: data.horasSemana,
            diasDescanso: data.diasDescanso,
            preferenciaTurno: data.preferenciaTurno,
            permitePartido: data.permitePartido,
            admiteHorasExtra: data.admiteHorasExtra,
          },
          update: {
            tipo: data.tipoContrato,
            horasSemana: data.horasSemana,
            diasDescanso: data.diasDescanso,
            preferenciaTurno: data.preferenciaTurno,
            permitePartido: data.permitePartido,
            admiteHorasExtra: data.admiteHorasExtra,
          },
        },
      },
    },
  });

  revalidatePath("/cuadrantes");
  revalidatePath("/empleados");
  return { ok: true };
}

export async function toggleDisponibilidadActivaAction(
  ubicacionId: string,
  id: string,
  activa: boolean
): Promise<Resultado> {
  await asegurarAcceso(ubicacionId);
  const disp = await prisma.disponibilidad.findUnique({
    where: { id },
    include: { empleado: true },
  });
  if (!disp || disp.empleado.ubicacionId !== ubicacionId) {
    return fallo("Restricción no encontrada");
  }

  await prisma.disponibilidad.update({
    where: { id },
    data: { activa },
  });

  revalidatePath("/cuadrantes");
  return { ok: true };
}

function startDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
