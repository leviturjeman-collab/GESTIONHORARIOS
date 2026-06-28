import {
  ETIQUETA_OPERACION_IA,
  ETIQUETA_PROVEEDOR,
  proveedorDeModelo,
  type ProveedorIA,
} from "@/lib/enums";
import { modeloPara } from "@/lib/ai/anthropic";

/** Forma mínima de un registro de UsoIA necesaria para el resumen. */
export type RegistroUso = {
  operacion: string;
  modelo: string;
  tokensEntrada: number;
  tokensSalida: number;
  costeEur: number;
  creadoEn: Date;
};

export type FilaUsoIA = {
  operacion: string;
  etiquetaOperacion: string;
  modelo: string;
  proveedor: ProveedorIA;
  etiquetaProveedor: string;
  llamadas: number;
  tokens: number;
  coste: number;
};

export type TotalProveedor = {
  proveedor: ProveedorIA;
  etiqueta: string;
  llamadas: number;
  tokens: number;
  coste: number;
};

export type ResumenUsoIA = {
  filas: FilaUsoIA[];
  totalesProveedor: TotalProveedor[];
  costeTotal: number;
  llamadasTotal: number;
};

const ORDEN_PROVEEDOR: Record<ProveedorIA, number> = {
  anthropic: 0,
  google: 1,
  otro: 2,
};

/**
 * Agrupa el consumo de IA por operación mostrando el MODELO REALMENTE usado
 * (el de la llamada más reciente de cada operación, no el configurado por
 * entorno) y reparte el coste por proveedor/API key. Solo incluye operaciones
 * con llamadas reales registradas.
 */
export function resumenUsoIA(usos: RegistroUso[]): ResumenUsoIA {
  const operaciones = [...new Set(usos.map((u) => u.operacion))];

  const filas: FilaUsoIA[] = operaciones.map((op) => {
    const items = usos.filter((u) => u.operacion === op);
    const masReciente = items.reduce((a, b) => (a.creadoEn >= b.creadoEn ? a : b));
    // Mostrar el modelo que está configurado ACTUALMENTE para esta operación,
    // en lugar del modelo que se usó históricamente en la base de datos.
    const modeloActual = modeloPara(op);
    const modelo = modeloActual || masReciente.modelo;
    const proveedor = proveedorDeModelo(modelo);
    return {
      operacion: op,
      etiquetaOperacion: ETIQUETA_OPERACION_IA[op] ?? op,
      modelo,
      proveedor,
      etiquetaProveedor: ETIQUETA_PROVEEDOR[proveedor],
      llamadas: items.length,
      tokens: items.reduce((a, u) => a + u.tokensEntrada + u.tokensSalida, 0),
      coste: items.reduce((a, u) => a + u.costeEur, 0),
    };
  });

  filas.sort(
    (a, b) =>
      ORDEN_PROVEEDOR[a.proveedor] - ORDEN_PROVEEDOR[b.proveedor] ||
      b.coste - a.coste ||
      b.tokens - a.tokens
  );

  // Totales por proveedor = consumo de cada API key.
  const porProveedor = new Map<ProveedorIA, TotalProveedor>();
  for (const f of filas) {
    const t =
      porProveedor.get(f.proveedor) ??
      { proveedor: f.proveedor, etiqueta: f.etiquetaProveedor, llamadas: 0, tokens: 0, coste: 0 };
    t.llamadas += f.llamadas;
    t.tokens += f.tokens;
    t.coste += f.coste;
    porProveedor.set(f.proveedor, t);
  }
  const totalesProveedor = [...porProveedor.values()].sort(
    (a, b) => ORDEN_PROVEEDOR[a.proveedor] - ORDEN_PROVEEDOR[b.proveedor]
  );

  return {
    filas,
    totalesProveedor,
    costeTotal: usos.reduce((a, u) => a + u.costeEur, 0),
    llamadasTotal: usos.length,
  };
}
