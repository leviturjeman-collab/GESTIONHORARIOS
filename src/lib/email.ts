import { Resend } from "resend";

/**
 * Abstracción de envío de correo. Hoy usa Resend; cambiar de proveedor solo
 * requiere reescribir esta función. Sin RESEND_API_KEY, los correos se
 * registran por consola (modo simulado) para desarrollo.
 */
const apiKey = process.env.RESEND_API_KEY?.trim();
const FROM = process.env.EMAIL_FROM || "Gestión Horarios <onboarding@resend.dev>";

export const EMAIL_ACTIVO = Boolean(apiKey);
const resend = apiKey ? new Resend(apiKey) : null;

export async function enviarEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ simulado: boolean }> {
  if (!resend) {
    console.log(
      `\n📧 [correo simulado] Para: ${opts.to}\n   Asunto: ${opts.subject}\n   ${opts.text}\n`
    );
    return { simulado: true };
  }
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html ?? `<p>${opts.text}</p>`,
  });
  
  if (error) {
    console.error("Resend Error:", error);
    throw new Error(error.message);
  }
  
  return { simulado: false };
}
