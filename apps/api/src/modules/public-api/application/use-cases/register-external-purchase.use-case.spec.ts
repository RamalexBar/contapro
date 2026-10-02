import { describe, expect, it, vi } from "vitest";
import { calculateNitCheckDigit } from "@erp/shared-utils";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { CreateSupplierData, ISupplierRepository, SupplierRecord } from "../../../suppliers/domain/supplier.repository";
import type { ExpenseCategoryRecord, IExpenseCategoryRepository } from "../../../expenses/domain/expense-category.repository";
import type { CreatePurchaseUseCase } from "../../../suppliers/application/use-cases/create-purchase.use-case";
import type { RegisterSupplierPaymentUseCase } from "../../../suppliers/application/use-cases/register-supplier-payment.use-case";
import type { ExternalApiRequestRecord, IExternalApiRequestRepository } from "../../domain/external-api-request.repository";
import { RegisterExternalPurchaseUseCase } from "./register-external-purchase.use-case";
import type { RegisterExternalPurchaseInput } from "@erp/shared-types";

const NIT = "900123456";
const DV = calculateNitCheckDigit(NIT);

class FakeSupplierRepository implements Partial<ISupplierRepository> {
  suppliers: SupplierRecord[] = [];
  created: CreateSupplierData[] = [];
  async findByNit(nit: string): Promise<SupplierRecord | null> {
    return this.suppliers.find((s) => s.nit === nit) ?? null;
  }
  async create(data: CreateSupplierData): Promise<SupplierRecord> {
    this.created.push(data);
    const record: SupplierRecord = {
      id: `supplier-${this.created.length}`,
      name: data.name,
      nit: data.nit,
      contactName: null,
      phone: null,
      email: null,
      address: null,
      isActive: true,
      isObligatedToInvoice: data.isObligatedToInvoice ?? true,
      documentType: data.documentType ?? "NIT",
      municipalityCode: null,
    };
    this.suppliers.push(record);
    return record;
  }
}

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

function makeInput(overrides: Partial<RegisterExternalPurchaseInput> = {}): RegisterExternalPurchaseInput {
  return {
    branchId: "branch-1",
    supplier: { nit: NIT, dv: DV, name: "Distribuidora ACME" },
    invoiceNumber: "FE-100",
    invoiceDate: new Date("2026-09-28"),
    taxBreakdown: [{ taxRate: 19, taxableBase: 100_000, taxAmount: 19_000 }],
    total: 119_000,
    payment: { term: "CREDIT", dueDate: new Date("2026-11-01") },
    currency: "COP",
    exchangeRate: 1,
    ...overrides,
  };
}

function makeDeps() {
  const supplierRepo = new FakeSupplierRepository();
  const categoryRepo = { findByCode: vi.fn().mockResolvedValue(null) } as unknown as IExpenseCategoryRepository;
  const createPurchase = {
    execute: vi.fn().mockResolvedValue({ id: "purchase-1", accountPayableId: "ap-1", total: 119_000, status: "REGISTERED" }),
  } as unknown as CreatePurchaseUseCase;
  const registerSupplierPayment = {
    execute: vi.fn().mockResolvedValue({
      payment: { id: "payment-1", amount: 119_000 },
      accountPayable: { id: "ap-1", status: "PAID", balance: 0 },
    }),
  } as unknown as RegisterSupplierPaymentUseCase;
  const idempotencyRepo = new FakeIdempotencyRepository();
  return { supplierRepo, categoryRepo, createPurchase, registerSupplierPayment, idempotencyRepo };
}

describe("RegisterExternalPurchaseUseCase", () => {
  it("creates a new supplier by NIT, validates the DV, and registers a credit purchase", async () => {
    const { supplierRepo, categoryRepo, createPurchase, registerSupplierPayment, idempotencyRepo } = makeDeps();
    const useCase = new RegisterExternalPurchaseUseCase(
      supplierRepo as unknown as ISupplierRepository,
      categoryRepo,
      createPurchase,
      registerSupplierPayment,
      idempotencyRepo
    );

    const result = await useCase.execute(makeInput(), "receipt-1");

    expect(supplierRepo.created).toHaveLength(1);
    expect(createPurchase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ subtotal: 100_000, taxTotal: 19_000, total: 119_000, dueDate: new Date("2026-11-01"), withholdings: [] })
    );
    expect(registerSupplierPayment.execute).not.toHaveBeenCalled();
    expect(result).toEqual({ id: "purchase-1", accountPayableId: "ap-1", total: 119_000, accountPayableStatus: "PENDING" });
  });

  it("pays in full immediately for a CASH purchase", async () => {
    const { supplierRepo, categoryRepo, createPurchase, registerSupplierPayment, idempotencyRepo } = makeDeps();
    const useCase = new RegisterExternalPurchaseUseCase(
      supplierRepo as unknown as ISupplierRepository,
      categoryRepo,
      createPurchase,
      registerSupplierPayment,
      idempotencyRepo
    );

    const result = await useCase.execute(makeInput({ payment: { term: "CASH", method: "TRANSFER" } }), "receipt-2");

    expect(registerSupplierPayment.execute).toHaveBeenCalledWith({ accountPayableId: "ap-1", amount: 119_000, method: "TRANSFER" });
    expect(result.accountPayableStatus).toBe("PAID");
  });

  it("rejects a mismatched NIT check digit before touching anything", async () => {
    const { supplierRepo, categoryRepo, createPurchase, registerSupplierPayment, idempotencyRepo } = makeDeps();
    const useCase = new RegisterExternalPurchaseUseCase(
      supplierRepo as unknown as ISupplierRepository,
      categoryRepo,
      createPurchase,
      registerSupplierPayment,
      idempotencyRepo
    );

    await expect(useCase.execute(makeInput({ supplier: { nit: NIT, dv: (DV + 1) % 10, name: "X" } }), "receipt-3")).rejects.toBeInstanceOf(
      ValidationError
    );
    expect(createPurchase.execute).not.toHaveBeenCalled();
  });

  it("rejects a tax breakdown that does not add up to the total", async () => {
    const { supplierRepo, categoryRepo, createPurchase, registerSupplierPayment, idempotencyRepo } = makeDeps();
    const useCase = new RegisterExternalPurchaseUseCase(
      supplierRepo as unknown as ISupplierRepository,
      categoryRepo,
      createPurchase,
      registerSupplierPayment,
      idempotencyRepo
    );

    await expect(useCase.execute(makeInput({ total: 999_999 }), "receipt-4")).rejects.toBeInstanceOf(ValidationError);
    expect(createPurchase.execute).not.toHaveBeenCalled();
  });

  it("resolves the destination account from expenseCategoryCode for a service purchase", async () => {
    const { supplierRepo, createPurchase, registerSupplierPayment, idempotencyRepo } = makeDeps();
    const category: ExpenseCategoryRecord = { id: "cat-1", code: "FLETES", name: "Fletes y transporte", accountCode: "5160", isActive: true };
    const categoryRepo = { findByCode: vi.fn().mockResolvedValue(category) } as unknown as IExpenseCategoryRepository;
    const useCase = new RegisterExternalPurchaseUseCase(
      supplierRepo as unknown as ISupplierRepository,
      categoryRepo,
      createPurchase,
      registerSupplierPayment,
      idempotencyRepo
    );

    await useCase.execute(makeInput({ expenseCategoryCode: "FLETES" }), "receipt-5");

    expect(createPurchase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ destinationAccount: { code: "5160", name: "Fletes y transporte" } })
    );
  });

  it("replays the cached response on a retry with the same Idempotency-Key, without re-registering", async () => {
    const { supplierRepo, categoryRepo, createPurchase, registerSupplierPayment, idempotencyRepo } = makeDeps();
    const useCase = new RegisterExternalPurchaseUseCase(
      supplierRepo as unknown as ISupplierRepository,
      categoryRepo,
      createPurchase,
      registerSupplierPayment,
      idempotencyRepo
    );

    const first = await useCase.execute(makeInput(), "receipt-6");
    const second = await useCase.execute(makeInput(), "receipt-6");

    expect(second).toEqual(first);
    expect(createPurchase.execute).toHaveBeenCalledTimes(1);
  });
});
