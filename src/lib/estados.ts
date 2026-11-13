// Estados válidos de cada entidad del sistema.
// Importar desde acá para evitar strings sueltos en el código.

export const ESTADOS_FACTURA_RECIBIDA = [
  "pendiente_revision",
  "requiere_revision",
  "pendiente_pago",
  "pagada",
  "anulada",
  "rechazada",
] as const;
export type EstadoFacturaRecibida = typeof ESTADOS_FACTURA_RECIBIDA[number];

export const ESTADOS_FACTURA_EMITIDA = [
  "pendiente_revision",
  "requiere_revision",
  "cobro_pendiente",
  "cobrada",
  "anulada",
  "rechazada",
] as const;
export type EstadoFacturaEmitida = typeof ESTADOS_FACTURA_EMITIDA[number];

export const ESTADOS_ORDEN_PAGO = [
  "borrador",
  "emitida",
  "pagada",
] as const;
export type EstadoOrdenPago = typeof ESTADOS_ORDEN_PAGO[number];

export const ESTADOS_LOTE_PAGO = [
  "borrador",
  "pendiente",
  "aprobado",
  "ejecutado",
  "cancelado",
] as const;
export type EstadoLotePago = typeof ESTADOS_LOTE_PAGO[number];

export const ESTADOS_DECLARACION_JURADA = [
  "pendiente",
  "presentada",
  "pagada",
] as const;
export type EstadoDeclaracionJurada = typeof ESTADOS_DECLARACION_JURADA[number];

export const ESTADOS_VENCIMIENTO_FISCAL = [
  "pendiente",
  "pagado",
] as const;
export type EstadoVencimientoFiscal = typeof ESTADOS_VENCIMIENTO_FISCAL[number];

export const ESTADOS_CHEQUE = [
  "emitido",
  "acreditado",
  "anulado",
] as const;
export type EstadoCheque = typeof ESTADOS_CHEQUE[number];

export const ESTADOS_INVERSION = [
  "activa",
  "vencida",
  "rescatada",
] as const;
export type EstadoInversion = typeof ESTADOS_INVERSION[number];
