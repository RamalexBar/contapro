import { describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../../../../shared/errors/app-error";
import type { CreateCustomerData, CustomerRecord, ICustomerRepository } from "../../../customers/domain/customer.repository";
import type { CreateManualInvoiceUseCase } from "../../../manual-invoicing/application/use-cases/create-manual-invoice.use-case";
import type { GetElectronicInvoiceUseCase } from "../../../electronic-invoicing/application/use-cases/get-electronic-invoice.use-case";
import { RegisterExternalElectronicInvoiceUseCase } from "./register-external-electronic-invoice.use-case";
import type { RegisterExternalElectronicInvoiceInput } from "@erp/shared-types";
import type { CreateExternalApiRequestData, ExternalApiRequestRecord, IExternalApiRequestRepository, UpdateExternalApiRequestData } from "../../domain/external-api-request.repository";

class FakeIdempotencyRepository implements IExternalApiRequestRepository {
  rows: ExternalApiRequestRecord[] = [];
  async create(data: CreateExternalApiRequestData): Promise<ExternalApiRequestRecord> {
    const row = { id: `req-${this.rows.length + 1}`, responseBody: null, errorMessage: null, createdAt: new Date(), ...data } as ExternalApiRequestRecord;
    this.rows.push(row);
    return row;
  }
  async update(id: string, data: UpdateExternalApiRequestData): Promise<ExternalApiRequestRecord> {
    const row = this.rows.find((r) => r.id === id)!;
    Object.assign(row, data);
    return row;
  }
  async findByReference(endpoint: string, externalReference: string): Promise<ExternalApiRequestRecord | null> {
    return this.rows.find((r) => r.endpoint === endpoint && r.externalReference === externalReference) ?? null;
  }
}

class FakeCustomerRepository implements Partial<ICustomerRepository> {
  customers: CustomerRecord[] = [];
  created: CreateCustomerData[] = [];
  async findByDocumentNumber(documentNumber: string): Promise<CustomerRecord | null> {
    return this.customers.find((c) => c.documentNumber === documentNumber) ?? null;
  }
  async create(data: CreateCustomerData): Promise<CustomerRecord> {
    this.created.push(data);
    const record: CustomerRecord = {
      id: `customer-${this.created.length}`,
      documentType: data.documentType,
      documentNumber: data.documentNumber,
      name: data.name,
      email: data.email ?? null,
      phone: data.phone ?? null,
      address: data.address ?? null,
      creditLimit: data.creditLimit ?? 0,
      currentBalance: 0,
      isActive: true,
      priceListId: data.priceListId ?? null,
      municipalityCode: data.municipalityCode ?? null,
      dianIdentityDocumentId: null,
      dianTypeOrganizationId: null,
      dianTaxRegimeId: null,
      dianTaxLevelId: null,
      dianCountryId: null,
      dianCityId: null,
      dianPostalCode: null,
    };
    this.customers.push(record);
    return record;
  }
}

const ITEMS = [{ description: "Corte de cabello", quantity: 1, unitPrice: 30_000, taxPercent: 19, taxType: "IVA" as const }];

function makeInput(overrides: Partial<RegisterExternalElectronicInvoiceInput> = {}): RegisterExternalElectronicInvoiceInput {
  return {
    branchId: "branch-1",
    buyer: { documentType: "CC", documentNumber: "123456789", name: "Laura Gomez" },
    items: ITEMS,
    ...overrides,
  };
}

describe("RegisterExternalElectronicInvoiceUseCase", () => {
  it("creates a new customer by document number when none exists yet", async () => {
    const customerRepo = new FakeCustomerRepository();
    const createManualInvoice = { execute: vi.fn().mockResolvedValue({ id: "inv-1" }) } as unknown as CreateManualInvoiceUseCase;
    const getElectronicInvoice = {
      execute: vi.fn().mockResolvedValue({ fullNumber: "SETP1", cufe: "a".repeat(96), status: "ACCEPTED" }),
    } as unknown as GetElectronicInvoiceUseCase;
    const useCase = new RegisterExternalElectronicInvoiceUseCase(customerRepo as unknown as ICustomerRepository, createManualInvoice, getElectronicInvoice, new FakeIdempotencyRepository());

    await useCase.execute(makeInput());

    expect(customerRepo.created).toHaveLength(1);
    expect(customerRepo.created[0].documentNumber).toBe("123456789");
    expect(createManualInvoice.execute).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: "branch-1", customerId: "customer-1", items: ITEMS })
    );
  });

  it("reuses an existing customer instead of creating a duplicate", async () => {
    const customerRepo = new FakeCustomerRepository();
    customerRepo.customers.push({
      id: "existing-customer",
      documentType: "CC",
      documentNumber: "123456789",
      name: "Laura Gomez",
      email: null,
      phone: null,
      address: null,
      creditLimit: 0,
      currentBalance: 0,
      isActive: true,
      priceListId: null,
      municipalityCode: null,
      dianIdentityDocumentId: null,
      dianTypeOrganizationId: null,
      dianTaxRegimeId: null,
      dianTaxLevelId: null,
      dianCountryId: null,
      dianCityId: null,
      dianPostalCode: null,
    });
    const createManualInvoice = { execute: vi.fn().mockResolvedValue({ id: "inv-1" }) } as unknown as CreateManualInvoiceUseCase;
    const getElectronicInvoice = {
      execute: vi.fn().mockResolvedValue({ fullNumber: "SETP1", cufe: "a".repeat(96), status: "ACCEPTED" }),
    } as unknown as GetElectronicInvoiceUseCase;
    const useCase = new RegisterExternalElectronicInvoiceUseCase(customerRepo as unknown as ICustomerRepository, createManualInvoice, getElectronicInvoice, new FakeIdempotencyRepository());

    await useCase.execute(makeInput());

    expect(customerRepo.created).toHaveLength(0);
    expect(createManualInvoice.execute).toHaveBeenCalledWith(expect.objectContaining({ customerId: "existing-customer" }));
  });

  it("bills to final consumer (customerId null) when buyer is omitted", async () => {
    const customerRepo = new FakeCustomerRepository();
    const createManualInvoice = { execute: vi.fn().mockResolvedValue({ id: "inv-1" }) } as unknown as CreateManualInvoiceUseCase;
    const getElectronicInvoice = {
      execute: vi.fn().mockResolvedValue({ fullNumber: "SETP1", cufe: "a".repeat(96), status: "ACCEPTED" }),
    } as unknown as GetElectronicInvoiceUseCase;
    const useCase = new RegisterExternalElectronicInvoiceUseCase(customerRepo as unknown as ICustomerRepository, createManualInvoice, getElectronicInvoice, new FakeIdempotencyRepository());

    await useCase.execute(makeInput({ buyer: undefined }));

    expect(createManualInvoice.execute).toHaveBeenCalledWith(expect.objectContaining({ customerId: null }));
  });

  it("returns status PENDING (not an error) when DIAN generation has not happened yet", async () => {
    const customerRepo = new FakeCustomerRepository();
    const createManualInvoice = { execute: vi.fn().mockResolvedValue({ id: "inv-1" }) } as unknown as CreateManualInvoiceUseCase;
    const getElectronicInvoice = {
      execute: vi.fn().mockRejectedValue(new NotFoundError("ElectronicInvoice", "inv-1")),
    } as unknown as GetElectronicInvoiceUseCase;
    const useCase = new RegisterExternalElectronicInvoiceUseCase(customerRepo as unknown as ICustomerRepository, createManualInvoice, getElectronicInvoice, new FakeIdempotencyRepository());

    const result = await useCase.execute(makeInput());

    expect(result).toEqual({ id: "inv-1", fullNumber: null, cufe: null, status: "PENDING", pdfPath: "/api/public/v1/electronic-invoices/inv-1/pdf" });
  });

  it("returns the real fullNumber/cufe/status when the DIAN invoice was generated", async () => {
    const customerRepo = new FakeCustomerRepository();
    const createManualInvoice = { execute: vi.fn().mockResolvedValue({ id: "inv-1" }) } as unknown as CreateManualInvoiceUseCase;
    const getElectronicInvoice = {
      execute: vi.fn().mockResolvedValue({ fullNumber: "SETP42", cufe: "b".repeat(96), status: "ACCEPTED" }),
    } as unknown as GetElectronicInvoiceUseCase;
    const useCase = new RegisterExternalElectronicInvoiceUseCase(customerRepo as unknown as ICustomerRepository, createManualInvoice, getElectronicInvoice, new FakeIdempotencyRepository());

    const result = await useCase.execute(makeInput());

    expect(result).toEqual({ id: "inv-1", fullNumber: "SETP42", cufe: "b".repeat(96), status: "ACCEPTED", pdfPath: "/api/public/v1/electronic-invoices/inv-1/pdf" });
  });
  it("con Idempotency-Key: un reintento devuelve la misma factura y no emite otra", async () => {
    const createManualInvoice = { execute: vi.fn().mockResolvedValue({ id: "inv-1" }) } as unknown as CreateManualInvoiceUseCase;
    const getElectronicInvoice = {
      execute: vi.fn().mockResolvedValue({ fullNumber: "SETP7", cufe: "c".repeat(96), status: "ACCEPTED" }),
    } as unknown as GetElectronicInvoiceUseCase;
    const useCase = new RegisterExternalElectronicInvoiceUseCase(new FakeCustomerRepository() as unknown as ICustomerRepository, createManualInvoice, getElectronicInvoice, new FakeIdempotencyRepository());

    const first = await useCase.execute(makeInput(), "pos-venta-1");
    const again = await useCase.execute(makeInput(), "pos-venta-1");

    expect(again).toEqual(first);
    expect(createManualInvoice.execute).toHaveBeenCalledTimes(1);
  });

  it("si la primera vez fallo, el reintento con la misma key si factura", async () => {
    const createManualInvoice = {
      execute: vi.fn().mockRejectedValueOnce(new Error("sin conexion")).mockResolvedValue({ id: "inv-2" }),
    } as unknown as CreateManualInvoiceUseCase;
    const getElectronicInvoice = {
      execute: vi.fn().mockResolvedValue({ fullNumber: "SETP8", cufe: "d".repeat(96), status: "ACCEPTED" }),
    } as unknown as GetElectronicInvoiceUseCase;
    const useCase = new RegisterExternalElectronicInvoiceUseCase(new FakeCustomerRepository() as unknown as ICustomerRepository, createManualInvoice, getElectronicInvoice, new FakeIdempotencyRepository());

    await expect(useCase.execute(makeInput(), "pos-venta-2")).rejects.toThrow("sin conexion");
    const retry = await useCase.execute(makeInput(), "pos-venta-2");

    expect(retry.fullNumber).toBe("SETP8");
    expect(createManualInvoice.execute).toHaveBeenCalledTimes(2);
  });

  it("pasa el tipo de impuesto (INC de restaurante) a la factura", async () => {
    const createManualInvoice = { execute: vi.fn().mockResolvedValue({ id: "inv-3" }) } as unknown as CreateManualInvoiceUseCase;
    const getElectronicInvoice = { execute: vi.fn().mockResolvedValue({ fullNumber: "SETP9", cufe: "e", status: "ACCEPTED" }) } as unknown as GetElectronicInvoiceUseCase;
    const useCase = new RegisterExternalElectronicInvoiceUseCase(new FakeCustomerRepository() as unknown as ICustomerRepository, createManualInvoice, getElectronicInvoice, new FakeIdempotencyRepository());
    const items = [{ description: "Bandeja paisa", quantity: 1, unitPrice: 25_925.93, taxPercent: 8, taxType: "INC" as const }];

    await useCase.execute(makeInput({ items }));

    expect(createManualInvoice.execute).toHaveBeenCalledWith(expect.objectContaining({ items }));
  });
});
