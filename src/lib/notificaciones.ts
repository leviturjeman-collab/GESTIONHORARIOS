import { prisma } from "@/lib/prisma";
import { enviarEmail } from "@/lib/email";
import type { TipoNotificacion } from "@/lib/enums";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

type Aviso = {
  tipo: TipoNotificacion;
  titulo: string;
  cuerpo: string;
  enlace?: string;
};

/**
 * Notifica a los administradores de la organización: crea la notificación
 * in-app y envía el correo (spec §11, destinatario = administrador en v1).
 */
export async function notificarAdmins(organizacionId: string, aviso: Aviso) {
  const admins = await prisma.usuario.findMany({
    where: { organizacionId, rol: "ADMIN", activo: true },
    select: { id: true, email: true },
  });

  await Promise.all(
    admins.map(async (a) => {
      await prisma.notificacion.create({
        data: {
          organizacionId,
          destinatarioId: a.id,
          tipo: aviso.tipo,
          titulo: aviso.titulo,
          cuerpo: aviso.cuerpo,
          enlace: aviso.enlace,
          emailEnviado: true,
        },
      });
      await enviarEmail({
        to: a.email,
        subject: aviso.titulo,
        text: `${aviso.cuerpo}\n\nAbrir: ${APP_URL}${aviso.enlace ?? ""}`,
      });
    })
  );
}

/** Notifica a un usuario concreto (p. ej. un empleado) in-app. */
export async function notificarUsuario(
  organizacionId: string,
  destinatarioId: string,
  aviso: Aviso
) {
  await prisma.notificacion.create({
    data: {
      organizacionId,
      destinatarioId,
      tipo: aviso.tipo,
      titulo: aviso.titulo,
      cuerpo: aviso.cuerpo,
      enlace: aviso.enlace,
    },
  });
}
