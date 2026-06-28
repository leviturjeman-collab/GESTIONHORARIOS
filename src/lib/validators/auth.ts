import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Correo no válido"),
  password: z.string().min(1, "Introduce tu contraseña"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const aceptarInvitacionSchema = z
  .object({
    token: z.string().min(10),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmar: z.string(),
  })
  .refine((d) => d.password === d.confirmar, {
    message: "Las contraseñas no coinciden",
    path: ["confirmar"],
  });
