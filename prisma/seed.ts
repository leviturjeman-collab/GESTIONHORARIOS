/**
 * Datos de demostración para Gestión Horarios.
 * 1 organización · 2 ubicaciones · 12 empleados (roles de hostelería) ·
 * cuadrante de la semana actual · vacaciones, baja, cambio de turno y avisos.
 *
 * Contraseña de todas las cuentas demo: demo1234
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ── helpers de fecha (semana europea, lunes) ──
function lunesDeSemana(d = new Date()): Date {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // 0 = lunes
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

async function main() {
  console.log("🌱 Sembrando datos demo…");

  // Limpieza (orden inverso de dependencias) para idempotencia.
  await prisma.notificacion.deleteMany();
  await prisma.cambioTurno.deleteMany();
  await prisma.fichaje.deleteMany();
  await prisma.documento.deleteMany();
  await prisma.ausencia.deleteMany();
  await prisma.disponibilidad.deleteMany();
  await prisma.turno.deleteMany();
  await prisma.cuadrante.deleteMany();
  await prisma.plantilla.deleteMany();
  await prisma.coberturaMinima.deleteMany();
  await prisma.contrato.deleteMany();
  await prisma.empleado.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.ubicacion.deleteMany();
  await prisma.organizacion.deleteMany();

  const pass = await bcrypt.hash("demo1234", 10);

  // ── Organización ──
  const org = await prisma.organizacion.create({
    data: { nombre: "Grupo Sabores del Sur" },
  });

  // ── Ubicaciones ──
  const marina = await prisma.ubicacion.create({
    data: {
      organizacionId: org.id,
      nombre: "Restaurante La Marina",
      direccion: "Paseo Marítimo 12, Málaga",
      lat: 36.7196,
      lng: -4.4214,
      radioFichajeMetros: 100,
      horaApertura: "12:00",
      horaCierre: "00:00",
      requiereAprobacionCambios: true,
    },
  });
  const faro = await prisma.ubicacion.create({
    data: {
      organizacionId: org.id,
      nombre: "Café Bar El Faro",
      direccion: "Calle Larios 3, Málaga",
      lat: 36.7188,
      lng: -4.42,
      radioFichajeMetros: 100,
      horaApertura: "08:00",
      horaCierre: "22:00",
      requiereAprobacionCambios: false,
    },
  });

  // ── Usuarios de acceso ──
  await prisma.usuario.create({
    data: {
      organizacionId: org.id,
      email: "admin@demo.es",
      nombre: "Lucía Administradora",
      passwordHash: pass,
      rol: "ADMIN",
    },
  });
  await prisma.usuario.create({
    data: {
      organizacionId: org.id,
      email: "carmen@demo.es",
      nombre: "Carmen Ruiz",
      passwordHash: pass,
      rol: "MANAGER",
      ubicacionesGestionadas: { connect: { id: marina.id } },
    },
  });
  await prisma.usuario.create({
    data: {
      organizacionId: org.id,
      email: "antonio@demo.es",
      nombre: "Antonio Bravo",
      passwordHash: pass,
      rol: "MANAGER",
      ubicacionesGestionadas: { connect: { id: faro.id } },
    },
  });

  // ── Empleados ──
  type EmpSeed = {
    nombre: string;
    apellidos: string;
    rol: string;
    tipo: string;
    horas: number;
    coste: number;
    ubic: string;
    extra?: boolean; // admite horas extra
    login?: string; // email para crear cuenta EMPLEADO
  };

  const plantilla: EmpSeed[] = [
    // La Marina (variedad de contratos)
    { nombre: "Alba", apellidos: "Romero", rol: "camarero", tipo: "INDEFINIDO_COMPLETO", horas: 40, coste: 12, ubic: marina.id, login: "alba@demo.es" },
    { nombre: "Marcos", apellidos: "Gil", rol: "camarero", tipo: "INDEFINIDO_PARCIAL", horas: 25, coste: 11, ubic: marina.id },
    { nombre: "Ana", apellidos: "Torres", rol: "barra", tipo: "TEMPORAL_COMPLETO", horas: 40, coste: 12.5, ubic: marina.id },
    { nombre: "Diego", apellidos: "Núñez", rol: "cocinero", tipo: "INDEFINIDO_COMPLETO", horas: 40, coste: 13, ubic: marina.id },
    { nombre: "Sara", apellidos: "Vega", rol: "ayudante_cocina", tipo: "FORMACION", horas: 20, coste: 10.5, ubic: marina.id, extra: false },
    { nombre: "Pablo", apellidos: "Ortiz", rol: "encargado", tipo: "INDEFINIDO_COMPLETO", horas: 40, coste: 16, ubic: marina.id },
    // El Faro
    { nombre: "Hugo", apellidos: "Navarro", rol: "camarero", tipo: "INDEFINIDO_COMPLETO", horas: 40, coste: 12, ubic: faro.id, login: "hugo@demo.es" },
    { nombre: "Lucía", apellidos: "Méndez", rol: "barra", tipo: "FIJO_DISCONTINUO", horas: 30, coste: 11.5, ubic: faro.id },
    { nombre: "Javier", apellidos: "Soto", rol: "cocinero", tipo: "INDEFINIDO_COMPLETO", horas: 40, coste: 13, ubic: faro.id },
    { nombre: "Elena", apellidos: "Cano", rol: "camarero", tipo: "TEMPORAL_PARCIAL", horas: 25, coste: 11, ubic: faro.id },
    { nombre: "Raúl", apellidos: "Prieto", rol: "office", tipo: "POR_HORAS", horas: 18, coste: 10, ubic: faro.id, extra: false },
    { nombre: "Nerea", apellidos: "Díaz", rol: "encargado", tipo: "RELEVO", horas: 40, coste: 16, ubic: faro.id },
  ];

  const empleados: Record<string, { id: string; nombre: string; rol: string; ubic: string }> = {};

  for (const e of plantilla) {
    let usuarioId: string | undefined;
    if (e.login) {
      const u = await prisma.usuario.create({
        data: {
          organizacionId: org.id,
          email: e.login,
          nombre: `${e.nombre} ${e.apellidos}`,
          passwordHash: pass,
          rol: "EMPLEADO",
        },
      });
      usuarioId = u.id;
    }
    const emp = await prisma.empleado.create({
      data: {
        organizacionId: org.id,
        ubicacionId: e.ubic,
        usuarioId,
        nombre: e.nombre,
        apellidos: e.apellidos,
        email: e.login ?? `${e.nombre.toLowerCase()}.${e.apellidos.toLowerCase()}@sabores.es`,
        rolFuncional: e.rol,
        estado: e.login ? "ACTIVO" : "ACTIVO",
        origenDato: "IMPORTADO",
        pinFichaje: String(1001 + plantilla.indexOf(e)), // PIN demo: 1001, 1002, …

        contrato: {
          create: {
            tipo: e.tipo,
            horasSemana: e.horas,
            costeHora: e.coste,
            admiteHorasExtra: e.extra ?? true,
            diasDescanso: 2,
          },
        },
      },
    });
    empleados[`${e.nombre} ${e.apellidos}`] = {
      id: emp.id,
      nombre: e.nombre,
      rol: e.rol,
      ubic: e.ubic,
    };
  }

  // ── Cobertura mínima (ejemplos) ──
  await prisma.coberturaMinima.createMany({
    data: [
      { ubicacionId: marina.id, rol: "camarero", franjaInicio: "13:00", franjaFin: "16:00", minPersonas: 2 },
      { ubicacionId: marina.id, rol: "cocinero", franjaInicio: "12:00", franjaFin: "16:00", minPersonas: 1 },
      { ubicacionId: marina.id, rol: "barra", franjaInicio: "13:00", franjaFin: "23:00", minPersonas: 1 },
      { ubicacionId: faro.id, rol: "camarero", franjaInicio: "08:00", franjaFin: "14:00", minPersonas: 1 },
      { ubicacionId: faro.id, rol: "barra", franjaInicio: "08:00", franjaFin: "22:00", minPersonas: 1 },
    ],
  });

  // ── Cuadrante de la semana actual ──
  const lunes = lunesDeSemana();

  // La Marina: BORRADOR con turnos de comidas y cenas
  const cuadMarina = await prisma.cuadrante.create({
    data: { ubicacionId: marina.id, semanaInicio: lunes, estado: "BORRADOR", origen: "GENERADO_IA" },
  });
  const faroPub = await prisma.cuadrante.create({
    data: {
      ubicacionId: faro.id,
      semanaInicio: lunes,
      estado: "PUBLICADO",
      origen: "MANUAL",
      publicadoEn: new Date(),
    },
  });

  // Asigna turnos de lun a sáb (0..5) a los empleados de cada ubicación.
  const turnosData: any[] = [];
  const marinaEmps = Object.values(empleados).filter((e) => e.ubic === marina.id);
  const faroEmps = Object.values(empleados).filter((e) => e.ubic === faro.id);

  for (let d = 0; d < 6; d++) {
    const dia = addDays(lunes, d);
    for (const e of marinaEmps) {
      // descanso rotativo: cada empleado libra un día distinto
      if ((d + marinaEmps.indexOf(e)) % 6 === 5) continue;
      const partido = e.rol === "camarero" || e.rol === "encargado";
      turnosData.push({
        cuadranteId: cuadMarina.id,
        empleadoId: e.id,
        dia,
        horaInicio: e.rol === "cocinero" || e.rol === "ayudante_cocina" ? "12:00" : "13:00",
        horaFin: partido ? "16:30" : "23:00",
        horaInicio2: partido ? "20:00" : null,
        horaFin2: partido ? "23:30" : null,
        partido,
        rol: e.rol,
        descansoMin: 0,
      });
    }
    for (const e of faroEmps) {
      if ((d + faroEmps.indexOf(e)) % 6 === 4) continue;
      turnosData.push({
        cuadranteId: faroPub.id,
        empleadoId: e.id,
        dia,
        horaInicio: "08:00",
        horaFin: "15:00",
        partido: false,
        rol: e.rol,
        descansoMin: 30,
      });
    }
  }
  await prisma.turno.createMany({ data: turnosData });

  // ── Fichajes de HOY (demo) para la supervisión y la corrección ──
  const hoy0 = new Date();
  hoy0.setHours(0, 0, 0, 0);
  const at = (h: number, m: number) => {
    const d = new Date(hoy0);
    d.setHours(h, m, 0, 0);
    return d;
  };
  await prisma.fichaje.createMany({
    data: [
      { empleadoId: empleados["Alba Romero"].id, entrada: at(13, 8), salida: at(16, 35), dentroDeRadio: true, incidencia: "ENTRADA_TARDE" },
      { empleadoId: empleados["Ana Torres"].id, entrada: at(13, 0), salida: null, dentroDeRadio: true },
      { empleadoId: empleados["Diego Núñez"].id, entrada: at(12, 0), salida: at(20, 0), dentroDeRadio: true },
    ],
  });

  // ── Disponibilidad (ejemplos) ──
  await prisma.disponibilidad.createMany({
    data: [
      // Ana prefiere no trabajar de noche (recurrente)
      {
        empleadoId: empleados["Ana Torres"].id,
        recurrente: true,
        diaSemana: null,
        franjaInicio: "22:00",
        franjaFin: "23:59",
        estado: "PREFIERE_NO",
        notas: "Prefiere no cerrar de noche.",
      },
      // Marcos no disponible los domingos
      {
        empleadoId: empleados["Marcos Gil"].id,
        recurrente: true,
        diaSemana: 6,
        franjaInicio: "00:00",
        franjaFin: "23:59",
        estado: "NO_DISPONIBLE",
      },
    ],
  });

  // ── Ausencias ──
  await prisma.ausencia.create({
    data: {
      empleadoId: empleados["Marcos Gil"].id,
      tipo: "VACACIONES",
      estado: "PENDIENTE",
      fechaInicio: addDays(lunes, 14),
      fechaFin: addDays(lunes, 20),
      motivo: "Vacaciones de verano",
    },
  });
  await prisma.ausencia.create({
    data: {
      empleadoId: empleados["Ana Torres"].id,
      tipo: "VACACIONES",
      estado: "APROBADA",
      fechaInicio: addDays(lunes, 28),
      fechaFin: addDays(lunes, 34),
      resueltoEn: new Date(),
    },
  });
  await prisma.ausencia.create({
    data: {
      empleadoId: empleados["Sara Vega"].id,
      tipo: "BAJA",
      estado: "APROBADA",
      fechaInicio: addDays(lunes, -2),
      fechaFin: addDays(lunes, 5),
      motivo: "Baja médica",
    },
  });

  // ── Cambio de turno propuesto ──
  const turnoAlba = await prisma.turno.findFirst({
    where: { empleadoId: empleados["Alba Romero"].id, cuadranteId: cuadMarina.id },
  });
  if (turnoAlba) {
    await prisma.cambioTurno.create({
      data: {
        turnoOrigenId: turnoAlba.id,
        solicitanteId: empleados["Alba Romero"].id,
        destinoId: empleados["Marcos Gil"].id,
        estado: "PROPUESTO",
        mensaje: "¿Me cambias este turno? Tengo médico.",
      },
    });
  }

  // ── Notificaciones para el administrador ──
  const admin = await prisma.usuario.findUnique({ where: { email: "admin@demo.es" } });
  if (admin) {
    await prisma.notificacion.createMany({
      data: [
        {
          organizacionId: org.id,
          destinatarioId: admin.id,
          tipo: "SOLICITUD_VACACIONES",
          titulo: "Nueva solicitud de vacaciones",
          cuerpo: "Marcos Gil ha solicitado vacaciones (7 días).",
          enlace: "/vacaciones",
        },
        {
          organizacionId: org.id,
          destinatarioId: admin.id,
          tipo: "CUADRANTE_PUBLICADO",
          titulo: "Cuadrante publicado",
          cuerpo: "Café Bar El Faro ha publicado el cuadrante de esta semana.",
          enlace: "/cuadrantes",
          leida: true,
        },
      ],
    });
  }

  // ── Consumo de IA (DEMO) ──────────────────────────────────────────────
  // Datos de ejemplo para que el panel "Consumo de IA" muestre cifras.
  // ⚠️ Quitar este bloque cuando haya consumo real de la API.
  const PRECIOS: Record<string, [number, number]> = {
    "claude-opus-4-8": [5, 25],
    "claude-sonnet-4-6": [3, 15],
    "claude-haiku-4-5": [1, 5],
  };
  const costeEur = (modelo: string, ein: number, out: number) => {
    const [pi, po] = PRECIOS[modelo] ?? PRECIOS["claude-sonnet-4-6"];
    return ((ein / 1e6) * pi + (out / 1e6) * po) * 0.92;
  };
  const rand = ([a, b]: [number, number]) => a + Math.floor(Math.random() * (b - a));
  const opsModelo: { op: string; modelo: string; ein: [number, number]; out: [number, number] }[] = [
    { op: "ANALISIS", modelo: "claude-haiku-4-5", ein: [1200, 2600], out: [800, 1600] },
    { op: "GENERACION", modelo: "claude-sonnet-4-6", ein: [1500, 2300], out: [2400, 3600] },
    { op: "DETECCION", modelo: "claude-haiku-4-5", ein: [900, 1600], out: [300, 800] },
    { op: "ASISTENTE", modelo: "claude-sonnet-4-6", ein: [400, 1000], out: [200, 700] },
  ];
  const usosDemo = Array.from({ length: 24 }, (_, i) => {
    const cfg = opsModelo[i % opsModelo.length];
    const ein = rand(cfg.ein);
    const out = rand(cfg.out);
    return {
      organizacionId: org.id,
      ubicacionId: i % 3 === 0 ? null : i % 2 ? marina.id : faro.id,
      operacion: cfg.op,
      modelo: cfg.modelo,
      tokensEntrada: ein,
      tokensSalida: out,
      costeEur: costeEur(cfg.modelo, ein, out),
      creadoEn: addDays(lunes, -Math.floor(Math.random() * 27)),
    };
  });
  await prisma.usoIA.createMany({ data: usosDemo });

  console.log("✅ Datos demo creados.");
  console.log("   Admin:    admin@demo.es / demo1234");
  console.log("   Manager:  carmen@demo.es · antonio@demo.es / demo1234");
  console.log("   Empleado: alba@demo.es · hugo@demo.es / demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
