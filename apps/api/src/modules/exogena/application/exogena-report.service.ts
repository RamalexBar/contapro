import { round2 } from "@erp/shared-utils";
import type { IPurchaseRepository } from "../../suppliers/domain/purchase.repository";
import type { ISupplierRepository, SupplierRecord } from "../../suppliers/domain/supplier.repository";
import type { IAccountPayableRepository } from "../../suppliers/domain/account-payable.repository";
import type { ISaleRepository } from "../../pos/sale/domain/sale.repository";
import type { ICustomerRepository, CustomerRecord } from "../../customers/domain/customer.repository";
import type { IAccountReceivableRepository } from "../../collections/domain/account-receivable.repository";
import type { IWithholdingConceptRepository } from "../../accounting/domain/withholding-concept.repository";
import type {
  Format1003Row,
  Format1008Row,
  Format1009Row,
  ThirdPartyInfo,
} from "../domain/exogena-report.types";
import type { IExogenaDataReader } from "../domain/exogena-data.reader";
import {
  buildFormat1001,
  buildFormat1005,
  buildFormat1006,
  buildFormat1007,
  buildFormat2276,
  type Format1001Row,
  type Format1005Row,
  type Format1006Row,
  type Format1007Row,
  type Format2276Row,
} from "./exogena-formats";


/**
 * Reporte de informacion exogena DIAN (item 37 de docs/ALCANCE.md). Mismo patron que
 * AccountingReportsService: constructor-injected repos, cada metodo se auto-alimenta. Modulo
 * cross-cutting sin tabla propia -- agrega datos de suppliers/pos/customers/collections/
 * accounting en vez de invertir el flujo de dependencia hacia adentro de `accounting`.
 */
export class ExogenaReportService {
  constructor(
    private readonly purchaseRepo: IPurchaseRepository,
    private readonly saleRepo: ISaleRepository,
    private readonly supplierRepo: ISupplierRepository,
    private readonly customerRepo: ICustomerRepository,
    private readonly accountPayableRepo: IAccountPayableRepository,
    private readonly accountReceivableRepo: IAccountReceivableRepository,
    private readonly withholdingConceptRepo: IWithholdingConceptRepository,
    private readonly dataReader: IExogenaDataReader
  ) {}

  /** Pagos por proveedor y concepto (5002 honorarios, 5004 servicios, 5005 arrendamientos, 5007 inventario...). */
  async getFormat1001(year: number): Promise<Format1001Row[]> {
    return buildFormat1001(await this.dataReader.yearData(year));
  }

  /** IVA descontable (compras) e IVA de devoluciones en ventas. */
  async getFormat1005(year: number): Promise<Format1005Row[]> {
    return buildFormat1005(await this.dataReader.yearData(year));
  }

  /** IVA generado e impuesto al consumo. */
  async getFormat1006(year: number): Promise<Format1006Row[]> {
    return buildFormat1006(await this.dataReader.yearData(year));
  }

  /** Ingresos rentas de trabajo por empleado. */
  async getFormat2276(year: number): Promise<Format2276Row[]> {
    return buildFormat2276(await this.dataReader.payrollData(year));
  }

  async getFormat1003(year: number): Promise<Format1003Row[]> {
    const [purchases, concepts] = await Promise.all([this.purchaseRepo.listForYear(year), this.withholdingConceptRepo.list()]);
    const conceptMap = new Map(concepts.map((c) => [c.id, c]));

    const totals = new Map<string, Map<string, { base: number; amount: number }>>();
    for (const p of purchases) {
      for (const w of p.withholdings) {
        const bySupplier = totals.get(p.supplierId) ?? new Map<string, { base: number; amount: number }>();
        const agg = bySupplier.get(w.withholdingConceptId) ?? { base: 0, amount: 0 };
        agg.base = round2(agg.base + w.base);
        agg.amount = round2(agg.amount + w.amount);
        bySupplier.set(w.withholdingConceptId, agg);
        totals.set(p.supplierId, bySupplier);
      }
    }

    const rows: Format1003Row[] = [];
    for (const [supplierId, bySupplier] of totals) {
      const supplier = await this.supplierRepo.findByIdOrThrow(supplierId);
      for (const [conceptId, agg] of bySupplier) {
        const concept = conceptMap.get(conceptId);
        rows.push({
          supplierId,
          ...this.supplierInfo(supplier),
          conceptoRetencion: concept?.dianConceptCode ?? null,
          conceptoIncompleto: !concept?.dianConceptCode,
          valorBase: agg.base,
          valorRetencion: agg.amount,
        });
      }
    }
    return rows;
  }

  /** Ingresos por cliente, incluidos los de consumidor final (222222222 "CUANTIAS MENORES"). */
  async getFormat1007(year: number): Promise<Format1007Row[]> {
    return buildFormat1007(await this.dataReader.yearData(year));
  }

  async getFormat1008(): Promise<Format1008Row[]> {
    const receivables = await this.accountReceivableRepo.listActive();
    const totals = new Map<string, number>();
    for (const r of receivables) {
      totals.set(r.customerId, round2((totals.get(r.customerId) ?? 0) + r.balance));
    }

    const rows: Format1008Row[] = [];
    for (const [customerId, saldo] of totals) {
      const customer = await this.customerRepo.findByIdOrThrow(customerId);
      rows.push({ customerId, ...this.customerInfo(customer), saldo });
    }
    return rows;
  }

  async getFormat1009(): Promise<Format1009Row[]> {
    const payables = await this.accountPayableRepo.listActive();
    const totals = new Map<string, number>();
    for (const p of payables) {
      totals.set(p.supplierId, round2((totals.get(p.supplierId) ?? 0) + p.balance));
    }

    const rows: Format1009Row[] = [];
    for (const [supplierId, saldo] of totals) {
      const supplier = await this.supplierRepo.findByIdOrThrow(supplierId);
      rows.push({ supplierId, ...this.supplierInfo(supplier), saldo });
    }
    return rows;
  }

  private supplierInfo(supplier: SupplierRecord): ThirdPartyInfo {
    return {
      documentType: supplier.documentType,
      documentNumber: supplier.nit,
      name: supplier.name,
      municipalityCode: supplier.municipalityCode,
      incompleto: !supplier.municipalityCode,
    };
  }

  private customerInfo(customer: CustomerRecord): ThirdPartyInfo {
    return {
      documentType: customer.documentType,
      documentNumber: customer.documentNumber,
      name: customer.name,
      municipalityCode: customer.municipalityCode,
      incompleto: !customer.municipalityCode,
    };
  }
}
