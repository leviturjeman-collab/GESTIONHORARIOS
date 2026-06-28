import { z } from "zod";

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:mm");

export const ubicacionSchema = z.object({
  nombre: z.string().min(1, "Nombre obligatorio"),
  direccion: z.string().optional().default(""),
  horaApertura: hora,
  horaCierre: hora,
  requiereAprobacionCambios: z.coerce.boolean().default(true),
  managerId: z.string().optional().default(""),
  horarioCustom: z
    .object({
      aperturaSemana: hora,
      cierreSemana: hora,
      diferenteFinSemana: z.boolean(),
      aperturaFinSemana: hora,
      cierreFinSemana: hora,
      diasCierre: z.array(z.number()),
    })
    .optional(),
});

export type UbicacionInput = z.infer<typeof ubicacionSchema>;
