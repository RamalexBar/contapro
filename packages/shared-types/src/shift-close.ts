import { z } from "zod";

/**
 * Cierre de turno de caja reportado por un POS externo (item nuevo 2026-09-29, ver
 * apps/api/src/modules/public-api/README.md, seccion "Cierre de turno"). Un POS de alto volumen
 * (restaurante, droguería) NO manda una venta a la vez -- manda UN resumen por turno, y Contapro
 * lo convierte en pocos comprobantes contables (no uno por venta). El POS manda CONCEPTOS
 * ("efectivo", "tarjeta", "anticipo"), nunca codigos de cuenta -- Contapro los resuelve a las
 * cuentas del PUC de cada empresa (ver post-shift-close-journal-entry.use-case.ts).
 */

/** Como entro el dinero de las ventas del turno. TRADE_IN = equipo usado recibido como parte de
 * pago (entra como activo, no como caja/banco). PLATFORM = pedido de una plataforma tipo Rappi
 * (queda como cuenta por cobrar a la plataforma, no como caja/banco).
 * Agregados 2026-10-13 (conexion con Cajapro, docs de Cajapro paso 22):
 * CREDIT = venta fiada (cuenta por cobrar al cliente), ADVANCE = pagada con un anticipo que el
 * cliente ya habia dado (apartado, orden de servicio, reserva de hotel -- baja el pasivo),
 * COURIER = la cobro el domiciliario y todavia no la entrega (por legalizar), STORE_CREDIT =
 * pagada con el saldo a favor que le quedo al cliente de una devolucion. */
export const shiftClosePaymentMethodSchema = z.enum([
  "CASH",
  "CARD",
  "TRANSFER",
  "TRADE_IN",
  "PLATFORM",
  "CREDIT",
  "ADVANCE",
  "COURIER",
  "STORE_CREDIT",
]);
export type ShiftClosePaymentMethod = z.infer<typeof shiftClosePaymentMethodSchema>;

export const shiftClosePaymentSchema = z.object({
  method: shiftClosePaymentMethodSchema,
  amount: z.number().positive(),
  // Solo tiene sentido con method="PLATFORM" (ej. "Rappi") -- informativo, hoy todas las
  // plataformas comparten una sola cuenta contable (ver README, punto de "que falta").
  platformName: z.string().optional(),
  // Solo informativo con method="CREDIT": a quien se le fio (hoy todo va a una sola cuenta Clientes).
  customer: z.object({ documentNumber: z.string().nullish(), name: z.string() }).optional(),
});
export type ShiftClosePaymentInput = z.infer<typeof shiftClosePaymentSchema>;

// EXCLUDED (excluido de IVA, ej. salud/educacion) se trata igual que EXEMPT en el comprobante --
// la distincion solo importa para el formulario 300/informacion exogena DIAN (fuera de alcance de
// este endpoint), no para el asiento contable (ambos: ingreso sin IVA generado).
export const shiftCloseTaxTypeSchema = z.enum(["IVA", "INC", "EXEMPT", "EXCLUDED"]);
export type ShiftCloseTaxType = z.infer<typeof shiftCloseTaxTypeSchema>;

export const shiftCloseSalesTaxLineSchema = z.object({
  taxType: shiftCloseTaxTypeSchema,
  taxRate: z.number().min(0).max(100),
  taxableBase: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
});
export type ShiftCloseSalesTaxLineInput = z.infer<typeof shiftCloseSalesTaxLineSchema>;

export const shiftCloseReturnSchema = z.object({
  taxType: shiftCloseTaxTypeSchema,
  taxableAmount: z.number().nonnegative(),
  taxAmount: z.number().nonnegative().default(0),
  // CREDIT = la devolucion baja lo que el cliente debia (fiado); STORE_CREDIT = le queda como
  // saldo a favor para un cambio (agregados 2026-10-13).
  refundMethod: z.enum(["CASH", "CARD", "TRANSFER", "CREDIT", "STORE_CREDIT"]),
});
export type ShiftCloseReturnInput = z.infer<typeof shiftCloseReturnSchema>;

export const shiftCloseExpenseSchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1),
  // De donde salio la plata (agregado 2026-10-13; antes siempre era Caja).
  method: z.enum(["CASH", "CARD", "TRANSFER"]).default("CASH"),
});
export type ShiftCloseExpenseInput = z.infer<typeof shiftCloseExpenseSchema>;

export const shiftCloseWithdrawalSchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1),
});
export type ShiftCloseWithdrawalInput = z.infer<typeof shiftCloseWithdrawalSchema>;

/** Plata que ENTRA a la caja desde afuera (ej. el dueno repone base, o un consignacion que se
 * retira en efectivo) -- direccion opuesta a withdrawal. */
export const shiftCloseDepositSchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1),
});
export type ShiftCloseDepositInput = z.infer<typeof shiftCloseDepositSchema>;

/** Parte de un anticipo (apartado/orden de servicio) que el negocio se queda cuando el cliente
 * cancela SIN devolucion -- deja de ser pasivo (anticiposClientes) y pasa a ser ingreso. */
export const shiftCloseForfeitedAdvanceSchema = z.object({
  amount: z.number().positive(),
  description: z.string().optional(),
});
export type ShiftCloseForfeitedAdvanceInput = z.infer<typeof shiftCloseForfeitedAdvanceSchema>;

export const shiftCloseTipSchema = z.object({
  method: z.enum(["CASH", "CARD", "TRANSFER"]),
  amount: z.number().positive(),
});
export type ShiftCloseTipInput = z.infer<typeof shiftCloseTipSchema>;

/** Recargas/pedidos de plataformas de terceros donde el negocio solo se queda con una comision --
 * el resto es plata que debe al tercero (operador movil, plataforma), no ingreso propio. */
export const shiftCloseThirdPartyIncomeSchema = z.object({
  concept: z.string().min(1),
  amount: z.number().positive(),
  commission: z.number().nonnegative(),
});
export type ShiftCloseThirdPartyIncomeInput = z.infer<typeof shiftCloseThirdPartyIncomeSchema>;

/** Abono de un apartado/orden de servicio: anticipo del cliente, todavia no es ingreso (pasivo)
 * hasta que se entregue el producto/servicio -- ver README para por que no se reconoce como
 * ingreso aca. */
export const shiftCloseAdvanceKindSchema = z.enum(["LAYAWAY", "SERVICE", "HOTEL", "OTHER"]);

export const shiftCloseAdvanceSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(["CASH", "CARD", "TRANSFER"]),
  description: z.string().optional(),
  // Solo informativo (apartado, orden de servicio, reserva de hotel): todos van a Anticipos 2805.
  kind: shiftCloseAdvanceKindSchema.optional(),
});
export type ShiftCloseAdvanceInput = z.infer<typeof shiftCloseAdvanceSchema>;

/** Anticipo que se le DEVUELVE al cliente (ej. cancela la reserva) -- baja el pasivo, sale plata. */
export const shiftCloseAdvanceRefundSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(["CASH", "CARD", "TRANSFER"]),
  kind: shiftCloseAdvanceKindSchema.optional(),
});
export type ShiftCloseAdvanceRefundInput = z.infer<typeof shiftCloseAdvanceRefundSchema>;

const shiftCloseCounterpartySchema = z.object({ documentNumber: z.string().nullish(), name: z.string() });

/** Abono de un cliente a lo que debia (fiado) cobrado en la caja. */
export const shiftCloseDebtCollectionSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(["CASH", "CARD", "TRANSFER"]),
  customer: shiftCloseCounterpartySchema.optional(),
});
export type ShiftCloseDebtCollectionInput = z.infer<typeof shiftCloseDebtCollectionSchema>;

/** Domiciliario: FLOAT_OUT = se le da base (sale de caja); SETTLEMENT = entrega lo que cobro y la base. */
export const shiftCloseCourierMovementSchema = z.object({
  type: z.enum(["FLOAT_OUT", "SETTLEMENT"]),
  amount: z.number().positive(),
});
export type ShiftCloseCourierMovementInput = z.infer<typeof shiftCloseCourierMovementSchema>;

/** Plata que sale de la caja para pagarle a un tercero (ej. cargar saldo de recargas). */
export const shiftCloseThirdPartyPaymentSchema = z.object({
  concept: z.string().min(1),
  amount: z.number().positive(),
});
export type ShiftCloseThirdPartyPaymentInput = z.infer<typeof shiftCloseThirdPartyPaymentSchema>;

// externalReference NO va en el body -- viaja en el header HTTP "Idempotency-Key" (convencion
// estandar, mismo criterio que Stripe/muchas APIs de pagos), ver public-api.controller.ts. Este
// schema valida solo el body; el controller arma RegisterShiftCloseInput completo con el header.
export const registerShiftCloseBodySchema = z
  .object({
    branchId: z.string().uuid(),
    date: z.coerce.date(),
    payments: z.array(shiftClosePaymentSchema).default([]),
    salesTaxBreakdown: z.array(shiftCloseSalesTaxLineSchema).default([]),
    returns: z.array(shiftCloseReturnSchema).default([]),
    expenses: z.array(shiftCloseExpenseSchema).default([]),
    withdrawals: z.array(shiftCloseWithdrawalSchema).default([]),
    deposits: z.array(shiftCloseDepositSchema).default([]),
    advances: z.array(shiftCloseAdvanceSchema).default([]),
    forfeitedAdvances: z.array(shiftCloseForfeitedAdvanceSchema).default([]),
    tipsReceived: z.array(shiftCloseTipSchema).default([]),
    tipsPaidOut: z.number().nonnegative().default(0),
    thirdPartyIncome: z.array(shiftCloseThirdPartyIncomeSchema).default([]),
    // Agregados 2026-10-13 (conexion con Cajapro):
    advancesRefunded: z.array(shiftCloseAdvanceRefundSchema).default([]),
    debtCollections: z.array(shiftCloseDebtCollectionSchema).default([]),
    courierMovements: z.array(shiftCloseCourierMovementSchema).default([]),
    thirdPartyPayments: z.array(shiftCloseThirdPartyPaymentSchema).default([]),
    // Cuentas abiertas (mesa, habitacion) pagadas por partes en turnos distintos:
    // received = lo cobrado en ESTE turno de cuentas que todavia no se cerraron (anticipo, pasivo);
    // applied = lo cobrado en turnos ANTERIORES de cuentas que se cerraron en este (baja el pasivo).
    openAccounts: z
      .object({ received: z.number().nonnegative().default(0), applied: z.number().nonnegative().default(0) })
      .default({ received: 0, applied: 0 }),
    // Arqueo: lo esperado (segun lo que registro el turno) vs. lo contado fisicamente.
    cashExpected: z.number().nonnegative(),
    cashCounted: z.number().nonnegative(),
  })
  .refine((v) => v.thirdPartyIncome.every((t) => t.commission <= t.amount), {
    message: "La comision de un ingreso de terceros no puede superar el monto total",
    path: ["thirdPartyIncome"],
  });
export type RegisterShiftCloseBodyInput = z.infer<typeof registerShiftCloseBodySchema>;

export interface RegisterShiftCloseInput extends RegisterShiftCloseBodyInput {
  /** Del header "Idempotency-Key" -- id propio del POS externo para este cierre, unico por
   * empresa, permite reintentar sin duplicar (ver RegisterShiftCloseUseCase). */
  externalReference: string;
}
