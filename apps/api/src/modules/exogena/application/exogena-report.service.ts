import { round2 } from "@erp/shared-utils";
import type { IPurchaseRepository } from "../../suppliers/domain/purchase.repository";
import type { ISupplierRepository, SupplierRecord } from "../../suppliers/domain/supplier.repository";
import type { IAccountPayableRepository } from "../../suppliers/domain/account-payable.repository";
import type { ISaleRepository } from "../../pos/sale/domain/sale.repository";
import type { ICustomerRepository, CustomerRecord } from "../../customers/domain/customer.repository";
import type { IAccountReceivableRepository } from "../../collections/domain/account-receivable.repository";
import type { IWithholdingConceptRepository } from "../../accounting/domain/withholding-concept.repository";
import type {
  Format1001Row,
  Format1003Row,
  Format1007Row,
  Format1008Row,
  Format1009Row,
  ThirdPartyInfo,
} from "../domain/exogena-report.types";

/** Codigo DIAN de concepto de pago generico ("Compra de bienes y/o servicios") usado para TODAS
 * las filas del formato 1001 -- el catalogo de productos no clasifica compras por concepto DIAN
 * (5001 materias primas, 5002 servicios, etc.), asi que no hay forma de derivarlo por linea. Ver
 * README del modulo. */
const DEFAULT_PAYMENT_CONCEPT_CODE = "5002";

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
    private readonly withholdingConceptRepo: IWithholdingConceptRepository
  ) {}

  async getFormat1001(year: number): Promise<Format1001Row[]> {
    const purchases = await this.purchaseRepo.listForYear(year);
    const totals = new Map<string, { valorPago: number; valorRetencion: number }>();
    for (const p of purchases) {
      const agg = totals.get(p.supplierId) ?? { valorPago: 0, valorRetencion: 0 };
      agg.valorPago = round2(agg.valorPago + p.total);
      agg.valorRetencion = round2(agg.valorRetencion + p.retentionTotal);
      totals.set(p.supplierId, agg);
    }

    const rows: Format1001Row[] = [];
    for (const [supplierId, agg] of totals) {
      const supplier = await this.supplierRepo.findByIdOrThrow(supplierId);
      rows.push({
        supplierId,
        ...this.supplierInfo(supplier),
        conceptoPago: DEFAULT_PAYMENT_CONCEPT_CODE,
        valorPago: agg.valorPago,
        valorRetencionPracticada: agg.valorRetencion,
      });
    }
    return rows;
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

  async getFormat1007(year: number): Promise<Format1007Row[]> {
    const sales = await this.saleRepo.listForYear(year);
    const totals = new Map<string, number>();
    for (const s of sales) {
      // Ventas sin cliente identificado ("consumidor final") no son reportables a un tercero
      // especifico -- se excluyen del reporte, mismo criterio que electronic-invoicing usa un
      // identificador generico solo para la factura, no aplicable aqui.
      if (!s.customerId) continue;
      totals.set(s.customerId, round2((totals.get(s.customerId) ?? 0) + s.subtotal));
    }

    const rows: Format1007Row[] = [];
    for (const [customerId, valorIngreso] of totals) {
      const customer = await this.customerRepo.findByIdOrThrow(customerId);
      rows.push({ customerId, ...this.customerInfo(customer), valorIngreso });
    }
    return rows;
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
