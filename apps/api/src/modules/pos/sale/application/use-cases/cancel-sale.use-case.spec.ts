import { describe, expect, it, vi } from "vitest";
import { tenantStorage } from "../../../../../shared/context/request-context";
import { AuditService } from "../../../../audit/application/audit.service";
import type { IAuditLogRepository } from "../../../../audit/domain/audit-log.repository";
import type { IAccountReceivableRepository } from "../../../../collections/domain/account-receivable.repository";
import type { ISaleRepository, SaleRecord } from "../../domain/sale.repository";
import { CancelSaleUseCase, type ISaleInvoiceStatusReader } from "./cancel-sale.use-case";

const SALE = { id: "sale-1", number: 7, accountReceivableId: null } as unknown as SaleRecord;

function makeUseCase(invoice: { fullNumber: string; status: string } | null) {
  const saleRepo = {
    findByIdOrThrow: vi.fn().mockResolvedValue(SALE),
    cancel: vi.fn().mockResolvedValue({ ...SALE, status: "CANCELLED" }),
  } as unknown as ISaleRepository;
  const auditRepo = { create: vi.fn().mockResolvedValue({}), list: vi.fn() } as unknown as IAuditLogRepository;
  const invoiceReader: ISaleInvoiceStatusReader = { findBySaleId: vi.fn().mockResolvedValue(invoice) };
  const useCase = new CancelSaleUseCase(saleRepo, {} as IAccountReceivableRepository, new AuditService(auditRepo), invoiceReader);
  return { useCase, saleRepo };
}

const run = <T>(fn: () => Promise<T>) =>
  tenantStorage.run({ companyId: "company-1", branchId: null, userId: "user-1", roles: [], permissions: new Set() }, fn);

describe("CancelSaleUseCase", () => {
  it("refuses to cancel a sale whose electronic invoice was already accepted and points to a full return", async () => {
    const { useCase, saleRepo } = makeUseCase({ fullNumber: "SETP990042087", status: "ACCEPTED" });
    await expect(run(() => useCase.execute("sale-1", "error"))).rejects.toThrow(/devolucion total/);
    expect(saleRepo.cancel).not.toHaveBeenCalled();
  });

  it("still cancels a sale whose invoice never reached the DIAN", async () => {
    const { useCase, saleRepo } = makeUseCase({ fullNumber: "SETP1", status: "GENERATED" });
    await run(() => useCase.execute("sale-1", "error de digitacion"));
    expect(saleRepo.cancel).toHaveBeenCalledWith("sale-1", "error de digitacion");
  });

  it("cancels a sale without electronic invoice", async () => {
    const { useCase, saleRepo } = makeUseCase(null);
    await run(() => useCase.execute("sale-1", "prueba"));
    expect(saleRepo.cancel).toHaveBeenCalled();
  });
});
