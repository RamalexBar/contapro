import { basePrisma } from "@erp/database";
import { tenantStorage } from "../../../shared/context/request-context";
import type { CreateManualInvoiceUseCase } from "../../manual-invoicing/application/use-cases/create-manual-invoice.use-case";
import type { PostServiceIncomeJournalEntryUseCase } from "../../accounting/application/use-cases/post-service-income-journal-entry.use-case";
import type {
  ISubscriptionInvoiceIssuer,
  IssuedSubscriptionInvoice,
  SubscriptionInvoiceBuyer,
  SubscriptionInvoiceLine,
} from "../domain/subscription-invoicing";

/**
 * Emite la factura de la suscripcion como una factura manual (sin producto ni inventario) de la
 * empresa de Contapro: entra a su tenant con un contexto de sistema, igual que los pollers, busca o
 * crea al cliente por su documento y reusa CreateManualInvoiceUseCase, que ya genera la factura
 * electronica con el proveedor de esa empresa (Factus) y se la envia por correo al comprador.
 */
export class ManualInvoiceSubscriptionIssuer implements ISubscriptionInvoiceIssuer {
  constructor(
    private readonly loadCreateManualInvoice: () => Promise<CreateManualInvoiceUseCase>,
    private readonly loadPostServiceIncome: () => Promise<PostServiceIncomeJournalEntryUseCase>
  ) {}

  async issue(issuerCompanyId: string, buyer: SubscriptionInvoiceBuyer, line: SubscriptionInvoiceLine): Promise<IssuedSubscriptionInvoice> {
    const issuer = await basePrisma.company.findUnique({ where: { id: issuerCompanyId }, select: { id: true } });
    if (!issuer) throw new Error(`PLATFORM_INVOICING_COMPANY_ID (${issuerCompanyId}) no corresponde a ninguna empresa`);

    const branch =
      (await basePrisma.branch.findFirst({ where: { companyId: issuerCompanyId, isActive: true, isMain: true } })) ??
      (await basePrisma.branch.findFirst({ where: { companyId: issuerCompanyId, isActive: true }, orderBy: { createdAt: "asc" } }));
    if (!branch) throw new Error("La empresa de Contapro no tiene una sucursal activa para facturar");

    const customerId = await this.findOrCreateCustomer(issuerCompanyId, buyer);
    const createManualInvoice = await this.loadCreateManualInvoice();
    const postServiceIncome = await this.loadPostServiceIncome();
    const ctx = { companyId: issuerCompanyId, branchId: branch.id, userId: "system", roles: [], permissions: new Set<string>() };

    const invoice = await tenantStorage.run(ctx, () =>
        createManualInvoice.execute({
          branchId: branch.id,
          customerId,
          // Contapro factura como persona natural no responsable de IVA: la linea va sin IVA (excluida).
          items: [{ description: line.description, quantity: 1, unitPrice: line.amount, taxPercent: 0, taxType: "EXCLUDED" }],
        })
    );

    // La factura manual no contabiliza: el ingreso cobrado se registra aparte (Bancos/Caja contra
    // Ingresos por servicios). Si falla, la factura ya existe: se informa y se registra a mano.
    let journalError: string | null = null;
    try {
      await tenantStorage.run(ctx, () =>
        postServiceIncome.execute({
          branchId: branch.id,
          date: line.paidAt,
          description: `${line.description} - ${buyer.name}`,
          amount: line.amount,
          paymentMethod: line.paymentMethod,
          sourceType: "ManualInvoice",
          sourceId: invoice.id,
        })
      );
    } catch (err) {
      journalError = err instanceof Error ? err.message : String(err);
    }

    const electronic = await basePrisma.electronicInvoice.findFirst({
      where: { manualInvoiceId: invoice.id },
      select: { status: true, fullNumber: true },
    });
    return {
      manualInvoiceId: invoice.id,
      electronicStatus: electronic?.status ?? null,
      electronicNumber: electronic?.fullNumber ?? null,
      journalError,
    };
  }

  /** El cliente se identifica por su documento dentro de la empresa de Contapro; si ya existe se
   * actualizan correo y datos de contacto (la factura le llega al correo que tenga hoy). */
  private async findOrCreateCustomer(issuerCompanyId: string, buyer: SubscriptionInvoiceBuyer): Promise<string> {
    const data = {
      documentType: buyer.documentType,
      documentNumber: buyer.documentNumber,
      name: buyer.name,
      email: buyer.email,
      phone: buyer.phone,
      address: buyer.address,
      municipalityCode: buyer.municipalityCode,
      dianTaxLevelId: buyer.fiscalResponsibilities,
    };
    const existing = await basePrisma.customer.findFirst({
      where: { companyId: issuerCompanyId, documentNumber: buyer.documentNumber },
      select: { id: true },
    });
    if (existing) {
      await basePrisma.customer.update({ where: { id: existing.id }, data });
      return existing.id;
    }
    const created = await basePrisma.customer.create({ data: { ...data, companyId: issuerCompanyId } });
    return created.id;
  }
}
