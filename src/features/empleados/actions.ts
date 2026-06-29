"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireResponsable, requireAdmin, puedeUbicacion, empleadoEnAmbito, fallo, type Resultado } from "@/lib/guards";
import { empleadoSchema } from "@/lib/validators/empleado";
import { colorDeRol } from "@/lib/enums";
import { enviarEmail } from "@/lib/email";
import { borrarArchivos } from "@/lib/storage";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

/** Genera un PIN de acceso de 4 dígitos (1000–9999). */
function generarPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** PIN único dentro de la organización (para poder identificar al empleado en el login). */
async function pinUnico(organizacionId: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const pin = generarPin();
    const dup = await prisma.empleado.findFirst({ where: { organizacionId, pinFichaje: pin } });
    if (!dup) return pin;
  }
  return generarPin();
}

/**
 * Garantiza que el empleado tiene una cuenta de acceso con `pin` como
 * contraseña. Si no tiene correo real, usa uno sintético (el empleado nunca lo
 * usa: entra solo con su PIN). Devuelve el usuarioId.
 */
async function asegurarCuentaConPin(
  empleado: {
    id: string;
    email: string | null;
    nombre: string;
    apellidos: string | null;
    organizacionId: string;
    usuarioId: string | null;
  },
  pin: string
): Promise<string> {
  const hash = await bcrypt.hash(pin, 10);
  if (empleado.usuarioId) {
    await prisma.usuario.update({
      where: { id: empleado.usuarioId },
      data: { passwordHash: hash, activo: true },
    });
    return empleado.usuarioId;
  }
  const email = empleado.email || `${empleado.id}@pin.local`;
  const existe = await prisma.usuario.findUnique({ where: { email } });
  let usuarioId: string;
  if (existe) {
    await prisma.usuario.update({ where: { id: existe.id }, data: { passwordHash: hash, activo: true } });
    usuarioId = existe.id;
  } else {
    const nuevo = await prisma.usuario.create({
      data: {
        organizacionId: empleado.organizacionId,
        email,
        nombre: `${empleado.nombre} ${empleado.apellidos ?? ""}`.trim(),
        passwordHash: hash,
        rol: "EMPLEADO",
        activo: true,
      },
    });
    usuarioId = nuevo.id;
  }
  await prisma.empleado.update({ where: { id: empleado.id }, data: { usuarioId } });
  return usuarioId;
}

export async function crearEmpleado(
  raw: unknown
): Promise<Resultado<{ id: string; pin: string; conLogin: boolean }>> {
  const u = await requireResponsable();
  const parsed = empleadoSchema.safeParse(raw);
  if (!parsed.success) return fallo(parsed.error.errors[0]?.message ?? "Datos no válidos");
  const d = parsed.data;
  if (!(await puedeUbicacion(u, d.ubicacionId))) return fallo("Ubicación no permitida");

  // PIN único: sirve para el LOGIN del empleado y para el modo tablet.
  let pin = d.pinFichaje;
  if (pin) {
    const dup = await prisma.empleado.findFirst({ where: { organizacionId: u.organizacionId, pinFichaje: pin } });
    if (dup) return fallo("El PIN especificado ya está en uso por otro empleado");
  } else {
    pin = await pinUnico(u.organizacionId);
  }

  const emp = await prisma.empleado.create({
    data: {
      organizacionId: u.organizacionId,
      ubicacionId: d.ubicacionId,
      nombre: d.nombre,
      apellidos: d.apellidos || null,
      email: d.email ? d.email.toLowerCase() : null,
      telefono: d.telefono || null,
      rolFuncional: d.rolFuncional,
      color: colorDeRol(d.rolFuncional),
      estado: "ACTIVO",
      origenDato: "MANUAL",
      saldoVacaciones: d.saldoVacaciones,
      pinFichaje: pin,
      contrato: {
        create: {
          tipo: d.tipo,
          horasSemana: d.horasSemana,
          costeHora: d.costeHora,
          admiteHorasExtra: d.admiteHorasExtra,
        },
      },
    },
  });

  // Cuenta de acceso automática: el empleado entra SOLO con su PIN.
  await asegurarCuentaConPin(
    { id: emp.id, email: d.email || null, nombre: d.nombre, apellidos: d.apellidos || null, organizacionId: u.organizacionId, usuarioId: null },
    pin
  );

  revalidatePath("/empleados");
  return { ok: true, data: { id: emp.id, pin, conLogin: true } };
}

/** Regenera el PIN del empleado: nuevo PIN único + cuenta de acceso conectada a ese PIN. */
export async function regenerarPin(
  empleadoId: string
): Promise<Resultado<{ pin: string }>> {
  const u = await requireResponsable();
  if (!(await empleadoEnAmbito(u, empleadoId))) return fallo("Empleado no encontrado");
  const emp = await prisma.empleado.findUnique({
    where: { id: empleadoId },
    select: { id: true, email: true, nombre: true, apellidos: true, organizacionId: true, usuarioId: true },
  });
  if (!emp) return fallo("Empleado no encontrado");

  const pin = await pinUnico(emp.organizacionId);
  await prisma.empleado.update({ where: { id: empleadoId }, data: { pinFichaje: pin } });
  await asegurarCuentaConPin(emp, pin); // crea la cuenta si no existía y la conecta a este PIN

  revalidatePath("/empleados");
  return { ok: true, data: { pin } };
}

export async function actualizarEmpleado(id: string, raw: unknown): Promise<Resultado> {
  const u = await requireResponsable();
  if (!(await empleadoEnAmbito(u, id))) return fallo("Empleado no encontrado");
  const parsed = empleadoSchema.safeParse(raw);
  if (!parsed.success) return fallo(parsed.error.errors[0]?.message ?? "Datos no válidos");
  const d = parsed.data;
  if (!(await puedeUbicacion(u, d.ubicacionId))) return fallo("Ubicación no permitida");

  const empExistente = await prisma.empleado.findUnique({
    where: { id },
    select: { id: true, email: true, nombre: true, apellidos: true, organizacionId: true, usuarioId: true, pinFichaje: true },
  });
  if (!empExistente) return fallo("Empleado no encontrado");

  await prisma.empleado.update({
    where: { id },
    data: {
      ubicacionId: d.ubicacionId,
      nombre: d.nombre,
      apellidos: d.apellidos || null,
      email: d.email ? d.email.toLowerCase() : null,
      telefono: d.telefono || null,
      rolFuncional: d.rolFuncional,
      color: colorDeRol(d.rolFuncional),
      saldoVacaciones: d.saldoVacaciones,
      contrato: {
        upsert: {
          create: {
            tipo: d.tipo,
            horasSemana: d.horasSemana,
            costeHora: d.costeHora,
            admiteHorasExtra: d.admiteHorasExtra,
          },
          update: {
            tipo: d.tipo,
            horasSemana: d.horasSemana,
            costeHora: d.costeHora,
            admiteHorasExtra: d.admiteHorasExtra,
          },
        },
      },
    },
  });

  if (d.pinFichaje && d.pinFichaje !== empExistente.pinFichaje) {
    const dup = await prisma.empleado.findFirst({ where: { organizacionId: u.organizacionId, pinFichaje: d.pinFichaje } });
    if (dup) return fallo("El PIN especificado ya está en uso por otro empleado");
    await prisma.empleado.update({ where: { id }, data: { pinFichaje: d.pinFichaje } });
    await asegurarCuentaConPin(empExistente, d.pinFichaje);
  }

  revalidatePath("/empleados");
  return { ok: true };
}

export async function cambiarEstadoEmpleado(
  id: string,
  activo: boolean
): Promise<Resultado> {
  const u = await requireResponsable();
  if (!(await empleadoEnAmbito(u, id))) return fallo("Empleado no encontrado");
  await prisma.empleado.update({
    where: { id },
    data: { estado: activo ? "ACTIVO" : "INACTIVO" },
  });
  revalidatePath("/empleados");
  return { ok: true };
}

/** Invita al empleado por correo: crea (o reactiva) su cuenta de acceso EMPLEADO. */
export async function invitarEmpleado(id: string): Promise<Resultado> {
  const u = await requireResponsable();
  if (!(await empleadoEnAmbito(u, id))) return fallo("Empleado no encontrado");
  const emp = await prisma.empleado.findUnique({ where: { id } });
  if (!emp?.email) return fallo("El empleado no tiene correo configurado");

  const existe = await prisma.usuario.findUnique({ where: { email: emp.email } });
  const token = randomUUID();
  if (existe) {
    await prisma.usuario.update({
      where: { id: existe.id },
      data: { tokenInvitacion: token, invitacionExpira: new Date(Date.now() + 7 * 864e5) },
    });
    if (!emp.usuarioId) await prisma.empleado.update({ where: { id }, data: { usuarioId: existe.id } });
  } else {
    // Contraseña provisional aleatoria; el empleado la define al aceptar.
    const hash = await bcrypt.hash(randomUUID(), 10);
    const nuevo = await prisma.usuario.create({
      data: {
        organizacionId: u.organizacionId,
        email: emp.email,
        nombre: `${emp.nombre} ${emp.apellidos ?? ""}`.trim(),
        passwordHash: hash,
        rol: "EMPLEADO",
        tokenInvitacion: token,
        invitacionExpira: new Date(Date.now() + 7 * 864e5),
      },
    });
    await prisma.empleado.update({ where: { id }, data: { usuarioId: nuevo.id, estado: "INVITADO" } });
  }

  await enviarEmail({
    to: emp.email,
    subject: "Invitación a Gestión Horarios",
    text: `Hola ${emp.nombre}, accede a la app y define tu contraseña: ${APP_URL}/invitacion?token=${token}`,
  });
  revalidatePath("/empleados");
  return { ok: true };
}

/**
 * RGPD — derecho de supresión: borra la ficha del empleado (en cascada: contrato,
 * turnos, ausencias, fichajes, disponibilidades, documentos), su cuenta de acceso
 * y los archivos subidos. Solo administrador.
 */
export async function borrarDatosEmpleado(empleadoId: string): Promise<Resultado> {
  const u = await requireAdmin();
  const emp = await prisma.empleado.findUnique({
    where: { id: empleadoId },
    select: { organizacionId: true, usuarioId: true },
  });
  if (!emp || emp.organizacionId !== u.organizacionId) return fallo("Empleado no encontrado");

  // Recoge las rutas de los documentos ANTES de borrar (el empleado se elimina en
  // cascada en la BD; los archivos hay que quitarlos aparte del almacenamiento).
  const docs = await prisma.documento.findMany({
    where: { empleadoId },
    select: { ruta: true },
  });

  await prisma.empleado.delete({ where: { id: empleadoId } });
  if (emp.usuarioId) {
    try {
      await prisma.usuario.delete({ where: { id: emp.usuarioId } });
    } catch {
      /* la cuenta ya no existe */
    }
  }
  // Elimina los archivos del empleado del almacenamiento (Supabase Storage o local).
  await borrarArchivos(docs.map((d) => d.ruta));

  revalidatePath("/empleados");
  return { ok: true };
}

export async function enviarPinPorEmail(empleadoId: string): Promise<Resultado> {
  const u = await requireResponsable();
  if (!(await empleadoEnAmbito(u, empleadoId))) return fallo("Empleado no encontrado");
  const emp = await prisma.empleado.findUnique({
    where: { id: empleadoId },
    select: { id: true, nombre: true, email: true, pinFichaje: true },
  });
  if (!emp) return fallo("Empleado no encontrado");
  if (!emp.email) return fallo("El empleado no tiene dirección de correo electrónico");
  if (!emp.pinFichaje) return fallo("El empleado no tiene un PIN generado");

  const asunto = "Tu PIN de acceso - Gestión Horarios";
  const cuerpo = `Hola ${emp.nombre},\n\nTu PIN de acceso para registrar tu jornada y entrar a la plataforma es: ${emp.pinFichaje}\n\nIntroduce tu dirección de correo electrónico y este PIN para iniciar sesión.\n\nUn saludo,\nEl equipo de Gestión Horarios.`;
  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 12px;">
      <h2 style="color: #333;">Tu PIN de acceso</h2>
      <p>Hola <strong>${emp.nombre}</strong>,</p>
      <p>Tu PIN de acceso para registrar tu jornada y entrar a la plataforma es:</p>
      <div style="background-color: #f4f4f4; padding: 15px; text-align: center; border-radius: 8px; font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #111; font-family: monospace; margin: 20px 0;">
        ${emp.pinFichaje}
      </div>
      <p>Introduce tu dirección de correo electrónico y este PIN para iniciar sesión.</p>
      <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
      <p style="font-size: 12px; color: #666;">Este correo fue enviado de forma automática desde la plataforma de Gestión Horarios.</p>
    </div>
  `;

  try {
    await enviarEmail({
      to: emp.email,
      subject: asunto,
      text: cuerpo,
      html,
    });
    return { ok: true };
  } catch (error: any) {
    return fallo(error?.message ?? "Error al enviar el correo");
  }
}
