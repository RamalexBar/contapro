import { describe, expect, it, vi } from "vitest";
import type { CreateSupplierData, ISupplierRepository, SupplierRecord } from "../../../suppliers/domain/supplier.repository";
import type { CreatePurchaseUseCase } from "../../../suppliers/application/use-cases/create-purchase.use-case";
import { RegisterExternalPurchaseUseCase } from "./register-external-purchase.use-case";
import type { RegisterExternalPurchaseInput } from "@erp/shared-types";

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
      contactName: data.contactName ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      address: data.address ?? null,
      isActive: true,
      isObligatedToInvoice: data.isObligatedToInvoice ?? true,
      documentType: data.documentType ?? "NIT",
      municipalityCode: data.municipalityCode ?? null,
    };
    this.suppliers.push(record);
    return record;
  }
}

function makeInput(overrides: Partial<RegisterExternalPurchaseInput> = {}): RegisterExternalPurchaseInput {
  return {
    branchId: "branch-1",
    supplier: { nit: "900123456", name: "Distribuidora ACME" },
    invoiceNumber: "FE-100",
    subtotal: 100_000,
    taxTotal: 19_000,
    total: 119_000,
    dueDate: new Date("2026-11-01"),
    currency: "COP",
    exchangeRate: 1,
    ...overrides,
  };
}

describe("RegisterExternalPurchaseUseCase", () => {
  it("creates a new supplier by NIT when none exists yet", async () => {
    const supplierRepo = new FakeSupplierRepository();
    const createPurchase = {
      execute: vi.fn().mockResolvedValue({ id: "purchase-1", accountPayableId: "ap-1", total: 119_000, status: "REGISTERED" }),
    } as unknown as CreatePurchaseUseCase;
    const useCase = new RegisterExternalPurchaseUseCase(supplierRepo as unknown as ISupplierRepository, createPurchase);

    const result = await useCase.execute(makeInput());

    expect(supplierRepo.created).toHaveLength(1);
    expect(supplierRepo.created[0].nit).toBe("900123456");
    expect(createPurchase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: "branch-1", supplierId: "supplier-1", withholdings: [] })
    );
    expect(result).toEqual({ id: "purchase-1", accountPayableId: "ap-1", total: 119_000, status: "REGISTERED" });
  });

  it("reuses an existing supplier instead of creating a duplicate", async () => {
    const supplierRepo = new FakeSupplierRepository();
    supplierRepo.suppliers.push({
      id: "existing-supplier",
      name: "Distribuidora ACME",
      nit: "900123456",
      contactName: null,
      phone: null,
      email: null,
      address: null,
      isActive: true,
      isObligatedToInvoice: true,
      documentType: "NIT",
      municipalityCode: null,
    });
    const createPurchase = {
      execute: vi.fn().mockResolvedValue({ id: "purchase-1", accountPayableId: "ap-1", total: 119_000, status: "REGISTERED" }),
    } as unknown as CreatePurchaseUseCase;
    const useCase = new RegisterExternalPurchaseUseCase(supplierRepo as unknown as ISupplierRepository, createPurchase);

    await useCase.execute(makeInput());

    expect(supplierRepo.created).toHaveLength(0);
    expect(createPurchase.execute).toHaveBeenCalledWith(expect.objectContaining({ supplierId: "existing-supplier" }));
  });
});
