import type { RegisterExternalSupplierPaymentInput } from "@erp/shared-types";
import type { RegisterSupplierPaymentUseCase } from "../../../suppliers/application/use-cases/register-supplier-payment.use-case";
import type { IExternalApiRequestRepository } from "../../domain/external-api-request.repository";

const ENDPOINT = "supplier-payments";

export interface ExternalSupplierPaymentResult {
  accountPayableId: string;
  amount: number;
  balance: number;
  status: string;
}

/**
 * Capa de idempotencia sobre RegisterSupplierPaymentUseCase (modulo suppliers), el mismo caso de
 * uso que ya usa el panel interno -- sin logica de negocio nueva. Un abono NO es naturalmente
 * idempotente (reintentarlo sin proteccion pagaria dos veces), por eso exige el header
 * Idempotency-Key igual que /purchases y /shift-closes.
 */
export class RegisterExternalSupplierPaymentUseCase {
  constructor(
    private readonly registerSupplierPayment: RegisterSupplierPaymentUseCase,
    private readonly idempotencyRepo: IExternalApiRequestRepository
  ) {}

  async execute(input: RegisterExternalSupplierPaymentInput, externalReference: string): Promise<ExternalSupplierPaymentResult> {
    const existing = await this.idempotencyRepo.findByReference(ENDPOINT, externalReference);
    if (existing?.status === "POSTED") return existing.responseBody as ExternalSupplierPaymentResult;

    try {
      const paymentResult = await this.registerSupplierPayment.execute(input);
      const result: ExternalSupplierPaymentResult = {
        accountPayableId: paymentResult.accountPayable.id,
        amount: paymentResult.payment.amount,
        balance: paymentResult.accountPayable.balance,
        status: paymentResult.accountPayable.status,
      };
      if (existing) {
        await this.idempotencyRepo.update(existing.id, { status: "POSTED", responseBody: result });
      } else {
        await this.idempotencyRepo.create({ endpoint: ENDPOINT, externalReference, status: "POSTED", responseBody: result });
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (existing) {
        await this.idempotencyRepo.update(existing.id, { status: "FAILED", errorMessage });
      } else {
        await this.idempotencyRepo.create({ endpoint: ENDPOINT, externalReference, status: "FAILED", errorMessage });
      }
      throw err;
    }
  }
}
