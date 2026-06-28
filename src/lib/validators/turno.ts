import { z } from "zod";

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:mm");

export const turnoSchema = z.object({
  empleadoId: z.string().min(1),
  diaISO: z.string().min(8),
  horaInicio: hora,
  horaFin: hora,
  rol: z.string().min(1),
  partido: z.coerce.boolean().default(false),
  horaInicio2: z.union([hora, z.literal("")]).optional(),
  horaFin2: z.union([hora, z.literal("")]).optional(),
  descansoMin: z.coerce.number().min(0).max(240).default(0),
  notas: z.string().optional().default(""),
});

export type TurnoInput = z.infer<typeof turnoSchema>;
