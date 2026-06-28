import { z } from "zod";

export const ausenciaSchema = z
  .object({
    tipo: z.enum(["VACACIONES", "AUSENCIA", "BAJA"]),
    fechaInicio: z.string().min(8),
    fechaFin: z.string().min(8),
    motivo: z.string().optional().default(""),
  })
  .refine((d) => d.fechaFin >= d.fechaInicio, {
    message: "La fecha fin no puede ser anterior a la de inicio",
    path: ["fechaFin"],
  });

export type AusenciaInput = z.infer<typeof ausenciaSchema>;
