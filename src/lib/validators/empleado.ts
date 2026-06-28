import { z } from "zod";
import { ROLES_FUNCIONALES, TIPOS_CONTRATO } from "@/lib/enums";

export const empleadoSchema = z.object({
  nombre: z.string().min(1, "Nombre obligatorio"),
  apellidos: z.string().optional().default(""),
  email: z.string().email("Correo no válido").optional().or(z.literal("")),
  telefono: z.string().optional().default(""),
  rolFuncional: z.enum(ROLES_FUNCIONALES),
  ubicacionId: z.string().min(1, "Selecciona una ubicación"),
  tipo: z.enum(TIPOS_CONTRATO as [string, ...string[]]),
  admiteHorasExtra: z.coerce.boolean().default(true),
  horasSemana: z.coerce.number().min(0).max(60),
  costeHora: z.coerce.number().min(0).max(200),
  saldoVacaciones: z.coerce.number().int().min(0).max(60).default(30),
  pinFichaje: z.string().regex(/^\d{4}$/, "Debe tener 4 dígitos").optional().or(z.literal("")),
});

export type EmpleadoInput = z.infer<typeof empleadoSchema>;
