/**
 * "Enums lógicos" del dominio.
 *
 * Como SQLite (desarrollo) no soporta enums nativos de Prisma, los campos
 * correspondientes se almacenan como `String` y su validez se garantiza aquí
 * (y con Zod). Al migrar a PostgreSQL pueden convertirse en enums nativos sin
 * cambiar la lógica de la aplicación.
 */

export const Rol = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  EMPLEADO: "EMPLEADO",
} as const;
export type Rol = (typeof Rol)[keyof typeof Rol];
export const ROLES = Object.values(Rol);

export const EstadoEmpleado = {
  ACTIVO: "ACTIVO",
  INVITADO: "INVITADO",
  INACTIVO: "INACTIVO",
} as const;
export type EstadoEmpleado = (typeof EstadoEmpleado)[keyof typeof EstadoEmpleado];

export const OrigenDato = {
  IMPORTADO: "IMPORTADO",
  MANUAL: "MANUAL",
} as const;
export type OrigenDato = (typeof OrigenDato)[keyof typeof OrigenDato];

export const TipoContrato = {
  INDEFINIDO_COMPLETO: "INDEFINIDO_COMPLETO",
  INDEFINIDO_PARCIAL: "INDEFINIDO_PARCIAL",
  TEMPORAL_COMPLETO: "TEMPORAL_COMPLETO",
  TEMPORAL_PARCIAL: "TEMPORAL_PARCIAL",
  FIJO_DISCONTINUO: "FIJO_DISCONTINUO",
  FORMACION: "FORMACION",
  POR_HORAS: "POR_HORAS",
  RELEVO: "RELEVO",
} as const;
export type TipoContrato = (typeof TipoContrato)[keyof typeof TipoContrato];
export const TIPOS_CONTRATO = Object.values(TipoContrato);

export const ETIQUETA_CONTRATO: Record<string, string> = {
  INDEFINIDO_COMPLETO: "Indefinido · tiempo completo",
  INDEFINIDO_PARCIAL: "Indefinido · tiempo parcial",
  TEMPORAL_COMPLETO: "Temporal · tiempo completo",
  TEMPORAL_PARCIAL: "Temporal · tiempo parcial",
  FIJO_DISCONTINUO: "Fijo-discontinuo",
  FORMACION: "Formación / prácticas",
  POR_HORAS: "Por horas / extra",
  RELEVO: "De relevo",
};
export function etiquetaContrato(t: string): string {
  return ETIQUETA_CONTRATO[t] ?? t;
}
/** ¿El contrato es a tiempo parcial (para repartir menos días en la planificación)? */
export function esParcial(t: string): boolean {
  return t.includes("PARCIAL") || t === "POR_HORAS" || t === "FORMACION";
}

export const OrigenCuadrante = {
  IMPORTADO: "IMPORTADO",
  GENERADO_IA: "GENERADO_IA",
  MANUAL: "MANUAL",
} as const;
export type OrigenCuadrante = (typeof OrigenCuadrante)[keyof typeof OrigenCuadrante];

export const OperacionIA = {
  ANALISIS: "ANALISIS",
  GENERACION: "GENERACION",
  DETECCION: "DETECCION",
  ASISTENTE: "ASISTENTE",
  OCR: "OCR",
} as const;
export type OperacionIA = (typeof OperacionIA)[keyof typeof OperacionIA];

export const ETIQUETA_OPERACION_IA: Record<string, string> = {
  ANALISIS: "Análisis de cuadrante",
  GENERACION: "Generación de cuadrante",
  DETECCION: "Detección de problemas",
  ASISTENTE: "Asistente",
  OCR: "OCR de imágenes",
};

// ─────────────────────────── Proveedores de IA (API keys) ──────────────────
// Cada modelo se cobra a una API key distinta; agrupamos el consumo por aquí.
export type ProveedorIA = "anthropic" | "google" | "otro";

export const ETIQUETA_PROVEEDOR: Record<ProveedorIA, string> = {
  anthropic: "Anthropic (Claude)",
  google: "Google (Gemini)",
  otro: "Otro",
};

/** Deduce a qué proveedor/API key pertenece un modelo por su prefijo. */
export function proveedorDeModelo(modelo: string): ProveedorIA {
  const m = modelo.toLowerCase();
  if (m.startsWith("claude")) return "anthropic";
  if (m.startsWith("gemini") || m.startsWith("models/gemini")) return "google";
  return "otro";
}

// Precios vigentes por modelo (USD por millón de tokens, entrada/salida).
// Claude: tarifas oficiales de Anthropic. Gemini (OCR): la capa gratuita de
// Google AI Studio no factura, por eso va a 0; si pasas a un plan de pago,
// pon aquí el precio por millón de tokens del modelo y el coste se calculará solo.
export const PRECIOS_MODELO: Record<string, { entrada: number; salida: number }> = {
  "claude-opus-4-8": { entrada: 5, salida: 25 },
  "claude-sonnet-4-6": { entrada: 3, salida: 15 },
  "claude-haiku-4-5": { entrada: 1, salida: 5 },
  "claude-haiku-4-5-20251001": { entrada: 1, salida: 5 },
  // Gemini Flash (OCR) — capa gratuita: 0 €. Cámbialo si usas un plan de pago.
  "gemini-3.5-flash": { entrada: 0, salida: 0 },
  "gemini-2.5-flash": { entrada: 0, salida: 0 },
  "gemini-2.0-flash": { entrada: 0, salida: 0 },
};
const USD_A_EUR = 0.92;

/** Coste estimado en euros de una llamada según el modelo y los tokens. */
export function costeEur(modelo: string, tokensEntrada: number, tokensSalida: number): number {
  // Gemini sin precio configurado → capa gratuita (0 €). No lo tarificamos como Claude.
  if (proveedorDeModelo(modelo) === "google" && !PRECIOS_MODELO[modelo]) return 0;
  const p = PRECIOS_MODELO[modelo] ?? PRECIOS_MODELO["claude-sonnet-4-6"];
  const usd = (tokensEntrada / 1e6) * p.entrada + (tokensSalida / 1e6) * p.salida;
  return usd * USD_A_EUR;
}

export const EstadoCuadrante = {
  BORRADOR: "BORRADOR",
  PUBLICADO: "PUBLICADO",
  BLOQUEADO: "BLOQUEADO",
} as const;
export type EstadoCuadrante = (typeof EstadoCuadrante)[keyof typeof EstadoCuadrante];

export const EstadoDisponibilidad = {
  DISPONIBLE: "DISPONIBLE",
  PREFIERE_NO: "PREFIERE_NO",
  NO_DISPONIBLE: "NO_DISPONIBLE",
} as const;
export type EstadoDisponibilidad =
  (typeof EstadoDisponibilidad)[keyof typeof EstadoDisponibilidad];

export const TipoAusencia = {
  VACACIONES: "VACACIONES",
  AUSENCIA: "AUSENCIA",
  BAJA: "BAJA",
} as const;
export type TipoAusencia = (typeof TipoAusencia)[keyof typeof TipoAusencia];

export const EstadoSolicitud = {
  PENDIENTE: "PENDIENTE",
  APROBADA: "APROBADA",
  RECHAZADA: "RECHAZADA",
} as const;
export type EstadoSolicitud = (typeof EstadoSolicitud)[keyof typeof EstadoSolicitud];

export const EstadoCambioTurno = {
  PROPUESTO: "PROPUESTO",
  ACEPTADO: "ACEPTADO",
  PENDIENTE_APROBACION: "PENDIENTE_APROBACION",
  CONFIRMADO: "CONFIRMADO",
  RECHAZADO: "RECHAZADO",
} as const;
export type EstadoCambioTurno =
  (typeof EstadoCambioTurno)[keyof typeof EstadoCambioTurno];

export const IncidenciaFichaje = {
  ENTRADA_TARDE: "ENTRADA_TARDE",
  SALIDA_TEMPRANA: "SALIDA_TEMPRANA",
  SIN_FICHAR: "SIN_FICHAR",
  FUERA_DE_RADIO: "FUERA_DE_RADIO",
} as const;
export type IncidenciaFichaje =
  (typeof IncidenciaFichaje)[keyof typeof IncidenciaFichaje];

export const TipoDocumento = {
  CONTRATO: "CONTRATO",
  NOMINA: "NOMINA",
  JUSTIFICANTE: "JUSTIFICANTE",
} as const;
export type TipoDocumento = (typeof TipoDocumento)[keyof typeof TipoDocumento];

export const TipoNotificacion = {
  SOLICITUD_VACACIONES: "SOLICITUD_VACACIONES",
  RESOLUCION_VACACIONES: "RESOLUCION_VACACIONES",
  NUEVA_BAJA: "NUEVA_BAJA",
  CAMBIO_TURNO: "CAMBIO_TURNO",
  CUADRANTE_PUBLICADO: "CUADRANTE_PUBLICADO",
  INCIDENCIA_FICHAJE: "INCIDENCIA_FICHAJE",
  CONFLICTO_IA: "CONFLICTO_IA",
} as const;
export type TipoNotificacion =
  (typeof TipoNotificacion)[keyof typeof TipoNotificacion];

// ─────────────────────────── Roles funcionales (hostelería) ─────────────────
// No son niveles de acceso; describen el puesto del empleado para planificar.
export const ROLES_FUNCIONALES = [
  "encargado",
  "camarero",
  "cocinero",
  "barra",
  "cajero",
  "repartidor",
  "limpieza",
  "ayudante_cocina",
  "office",
  "host",
] as const;
export type RolFuncional = (typeof ROLES_FUNCIONALES)[number];

export const ETIQUETA_ROL_FUNCIONAL: Record<string, string> = {
  encargado: "Encargado/a",
  camarero: "Camarero/a",
  cocinero: "Cocinero/a",
  barra: "Barra",
  cajero: "Cajero/a",
  repartidor: "Repartidor/a",
  limpieza: "Limpieza",
  ayudante_cocina: "Ayudante de cocina",
  office: "Office",
  host: "Host / Recepción",
};

// Color por rol funcional (tarjeta de turno). Tonos accesibles sobre fondo claro.
export const COLOR_ROL_FUNCIONAL: Record<string, string> = {
  encargado: "#7c3aed",    // violeta
  camarero: "#0ea5e9",     // azul
  cocinero: "#ea580c",     // naranja
  barra: "#0d9488",        // teal
  cajero: "#8b5cf6",       // púrpura
  repartidor: "#059669",   // esmeralda
  limpieza: "#64748b",     // gris
  ayudante_cocina: "#d97706", // ámbar
  office: "#94a3b8",       // gris claro
  host: "#db2777",         // rosa
};

export function colorDeRol(rol: string): string {
  return COLOR_ROL_FUNCIONAL[rol] ?? "#0ea5e9";
}

export function etiquetaRol(rol: string): string {
  return ETIQUETA_ROL_FUNCIONAL[rol] ?? rol;
}
