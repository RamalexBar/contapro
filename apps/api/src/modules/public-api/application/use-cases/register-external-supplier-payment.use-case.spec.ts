import { describe, expect, it, vi } from "vitest";
import type { RegisterSupplierPaymentUseCase } from "../../../suppliers/application/use-cases/register-supplier-payment.use-case";
import type { ExternalApiRequestRecord, IExternalApiRequestRepository } from "../../domain/external-api-request.repository";
import { RegisterExternalSupplierPaymentUseCase } from "./register-external-supplier-payment.use-case";

class FakeIdempotencyRepository implements IExternalApiRequestRepository {
  rows: ExternalApiRequestRecord[] = [];
  async create(data: Parameters<IExternalApiRequestRepository["create"]>[0]): Promise<ExternalApiRequestRecord> {
    const row: ExternalApiRequestRecord = {
      id: `req-${this.rows.length + 1}`,
      endpoint: data.endpoint,
      externalReference: data.externalReference,
      status: data.status,
      responseBody: data.responseBody ?? null,
      errorMessage: data.errorMessage ?? null,
      createdAt: new Date(),
    };
    this.rows.push(row);
    return row;
  }
  async update(id: string, data: Parameters<IExternalApiRequestRepository["update"]>[1]): Promise<ExternalApiRequestRecord> {
    const row = this.rows.find((r) => r.id === id)!;
    row.status = data.status;
    row.responseBody = data.responseBody ?? null;
    row.errorMessage = data.errorMessage ?? null;
    return row;
  }
  async findByReference(endpoint: string, externalReference: string): Promise<ExternalApiRequestRecord | null> {
    return this.rows.find((r) => r.endpoint === endpoint && r.externalReference === externalReference) ?? null;
  }
}

const INPUT = { accountPayableId: "ap-1", amount: 50_000, method: "TRANSFER" };

describe("RegisterExternalSupplierPaymentUseCase", () => {
  it("registers the payment and caches the response", async () => {
    const registerSupplierPayment = {
      execute: vi.fn().mockResolvedValue({
        payment: { id: "payment-1", amount: 50_000 },
        accountPayable: { id: "ap-1", status: "PARTIAL", balance: 69_000 },
      }),
    } as unknown as RegisterSupplierPaymentUseCase;
    const idempotencyRepo = new FakeIdempotencyRepository();
    const useCase = new RegisterExternalSupplierPaymentUseCase(registerSupplierPayment, idempotencyRepo);

    const result = await useCase.execute(INPUT, "payment-event-1");

    expect(registerSupplierPayment.execute).toHaveBeenCalledWith(INPUT);
    expect(result).toEqual({ accountPayableId: "ap-1", amount: 50_000, balance: 69_000, status: "PARTIAL" });
  });

  it("replays the cached response on retry, without paying twice", async () => {
    const registerSupplierPayment = {
      execute: vi.fn().mockResolvedValue({
        payment: { id: "payment-1", amount: 50_000 },
        accountPayable: { id: "ap-1", status: "PARTIAL", balance: 69_000 },
      }),
    } as unknown as RegisterSupplierPaymentUseCase;
    const idempotencyRepo = new FakeIdempotencyRepository();
    const useCase = new RegisterExternalSupplierPaymentUseCase(registerSupplierPayment, idempotencyRepo);

    const first = await useCase.execute(INPUT, "payment-event-2");
    const second = await useCase.execute(INPUT, "payment-event-2");

    expect(second).toEqual(first);
    expect(registerSupplierPayment.execute).toHaveBeenCalledTimes(1);
  });

  it("allows a retry after a FAILED attempt instead of staying stuck", async () => {
    const registerSupplierPayment = { execute: vi.fn() } as unknown as RegisterSupplierPaymentUseCase;
    (registerSupplierPayment.execute as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("saldo insuficiente"))
      .mockResolvedValueOnce({ payment: { id: "payment-1", amount: 50_000 }, accountPayable: { id: "ap-1", status: "PARTIAL", balance: 69_000 } });
    const idempotencyRepo = new FakeIdempotencyRepository();
    const useCase = new RegisterExternalSupplierPaymentUseCase(registerSupplierPayment, idempotencyRepo);

    await expect(useCase.execute(INPUT, "payment-event-3")).rejects.toThrow("saldo insuficiente");
    const result = await useCase.execute(INPUT, "payment-event-3");

    expect(result.status).toBe("PARTIAL");
    expect(registerSupplierPayment.execute).toHaveBeenCalledTimes(2);
  });
});
