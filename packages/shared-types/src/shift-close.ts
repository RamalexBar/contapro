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
 * (queda como cuenta por cobrar a la plataforma, no como caja/banco). */
export const shiftClosePaymentMethodSchema = z.enum(["CASH", "CARD", "TRANSFER", "TRADE_IN", "PLATFORM"]);
export type ShiftClosePaymentMethod = z.infer<typeof shiftClosePaymentMethodSchema>;

export const shiftClosePaymentSchema = z.object({
  method: shiftClosePaymentMethodSchema,
  amount: z.number().positive(),
  // Solo tiene sentido con method="PLATFORM" (ej. "Rappi") -- informativo, hoy todas las
  // plataformas comparten una sola cuenta contable (ver README, punto de "que falta").
  platformName: z.string().optional(),
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
  refundMethod: z.enum(["CASH", "CARD", "TRANSFER"]),
});
export type ShiftCloseReturnInput = z.infer<typeof shiftCloseReturnSchema>;

export const shiftCloseExpenseSchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1),
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
export const shiftCloseAdvanceSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(["CASH", "CARD", "TRANSFER"]),
  description: z.string().optional(),
});
export type ShiftCloseAdvanceInput = z.infer<typeof shiftCloseAdvanceSchema>;

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
