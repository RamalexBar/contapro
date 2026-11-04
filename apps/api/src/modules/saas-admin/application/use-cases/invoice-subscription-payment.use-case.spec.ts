import { describe, expect, it } from "vitest";
import type { AuditService } from "../../../audit/application/audit.service";
import type {
  ISubscriptionInvoiceIssuer,
  ISubscriptionInvoiceRepository,
  IssuedSubscriptionInvoice,
  SubscriptionInvoiceBuyer,
  SubscriptionInvoiceLine,
  SubscriptionPaymentInvoiceData,
} from "../../domain/subscription-invoicing";
import { describeSubscriptionInvoice, InvoiceSubscriptionPaymentUseCase } from "./invoice-subscription-payment.use-case";

const ISSUER = "contapro-co";

function paymentData(overrides: Partial<SubscriptionPaymentInvoiceData> = {}): SubscriptionPaymentInvoiceData {
  return {
    paymentId: "pay-1",
    status: "CONFIRMED",
    amount: 129_900,
    manualInvoiceId: null,
    billedBy: null,
    planName: "Plan Pyme",
    billingCycle: "MONTHLY",
    coveredUntil: new Date("2026-12-04T12:00:00Z"),
    buyer: {
      companyId: "muebles",
      name: "Muebles El Roble SAS",
      documentType: "NIT",
      documentNumber: "900123456-7",
      email: "gerencia@roble.co",
      phone: null,
      address: null,
      municipalityCode: "66001",
      fiscalResponsibilities: null,
    },
    ...overrides,
  };
}

class FakeRepo implements ISubscriptionInvoiceRepository {
  invoiced: Record<string, string> = {};
  failed: Record<string, string> = {};
  constructor(private data: SubscriptionPaymentInvoiceData | null) {}
  async findPaymentInvoiceData() {
    return this.data;
  }
  async markPaymentInvoiced(paymentId: string, manualInvoiceId: string) {
    this.invoiced[paymentId] = manualInvoiceId;
  }
  async markPaymentInvoiceFailed(paymentId: string, error: string) {
    this.failed[paymentId] = error;
  }
}

class FakeIssuer implements ISubscriptionInvoiceIssuer {
  calls: { issuerCompanyId: string; buyer: SubscriptionInvoiceBuyer; line: SubscriptionInvoiceLine }[] = [];
  constructor(private result: IssuedSubscriptionInvoice | Error = { manualInvoiceId: "mi-1", electronicStatus: "ACCEPTED", electronicNumber: "CP1" }) {}
  async issue(issuerCompanyId: string, buyer: SubscriptionInvoiceBuyer, line: SubscriptionInvoiceLine) {
    this.calls.push({ issuerCompanyId, buyer, line });
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

const audit = { recordWithoutContext: async () => undefined } as unknown as AuditService;

function setup(data: SubscriptionPaymentInvoiceData | null, issuer = new FakeIssuer(), issuerCompanyId = ISSUER) {
  const repo = new FakeRepo(data);
  const alerts: string[] = [];
  const useCase = new InvoiceSubscriptionPaymentUseCase(repo, issuer, issuerCompanyId, audit, { send: (_k, subject) => alerts.push(subject) });
  return { repo, issuer, alerts, useCase };
}

describe("InvoiceSubscriptionPaymentUseCase", () => {
  it("factura el pago desde la empresa de Contapro, sin IVA, por el valor pagado", async () => {
    const { useCase, issuer, repo, alerts } = setup(paymentData());

    const outcome = await useCase.execute("pay-1");

    expect(outcome).toMatchObject({ status: "INVOICED", manualInvoiceId: "mi-1", electronicStatus: "ACCEPTED" });
    expect(issuer.calls).toHaveLength(1);
    expect(issuer.calls[0]!.issuerCompanyId).toBe(ISSUER);
    expect(issuer.calls[0]!.buyer.documentNumber).toBe("900123456-7");
    expect(issuer.calls[0]!.line).toEqual({
      description: "Suscripción Contapro - Plan Pyme (mensual), vigente hasta el 04/12/2026",
      amount: 129_900,
    });
    expect(repo.invoiced).toEqual({ "pay-1": "mi-1" });
    expect(alerts).toEqual([]);
  });

  it("sin empresa emisora configurada no hace nada", async () => {
    const { useCase, issuer } = setup(paymentData(), new FakeIssuer(), "");
    expect(await useCase.execute("pay-1")).toEqual({ status: "NOT_CONFIGURED" });
    expect(issuer.calls).toHaveLength(0);
  });

  it.each([
    ["ya facturado", { manualInvoiceId: "mi-0" }],
    ["pago pendiente", { status: "PENDING" }],
    ["combo cobrado por Cajapro", { billedBy: "CAJAPRO" }],
    ["la propia empresa de Contapro", { buyer: { ...paymentData().buyer, companyId: ISSUER } }],
    ["pago en cero", { amount: 0 }],
  ])("no factura: %s", async (_name, overrides) => {
    const { useCase, issuer } = setup(paymentData(overrides as Partial<SubscriptionPaymentInvoiceData>));
    expect((await useCase.execute("pay-1")).status).toBe("SKIPPED");
    expect(issuer.calls).toHaveLength(0);
  });

  it("sin codigo DANE del municipio no llama a Factus: falla con un mensaje claro", async () => {
    const { useCase, issuer, repo } = setup(paymentData({ buyer: { ...paymentData().buyer, municipalityCode: null } }));
    const outcome = await useCase.execute("pay-1");
    expect(outcome.status).toBe("FAILED");
    expect(repo.failed["pay-1"]).toContain("código DANE");
    expect(issuer.calls).toHaveLength(0);
  });

  it("si falla, guarda el error y avisa al equipo sin lanzar", async () => {
    const { useCase, repo, alerts } = setup(paymentData(), new FakeIssuer(new Error("Completa los datos fiscales")));

    const outcome = await useCase.execute("pay-1");

    expect(outcome).toEqual({ status: "FAILED", error: "Completa los datos fiscales" });
    expect(repo.failed["pay-1"]).toBe("Completa los datos fiscales");
    expect(repo.invoiced).toEqual({});
    expect(alerts).toEqual(["No se pudo facturar un pago de suscripción"]);
  });

  it("avisa si la factura quedo creada pero la DIAN no la acepto", async () => {
    const { useCase, alerts, repo } = setup(
      paymentData({ billingCycle: "YEARLY" }),
      new FakeIssuer({ manualInvoiceId: "mi-2", electronicStatus: "REJECTED", electronicNumber: "CP2" })
    );

    const outcome = await useCase.execute("pay-1");

    expect(outcome.status).toBe("INVOICED");
    expect(repo.invoiced).toEqual({ "pay-1": "mi-2" });
    expect(alerts).toEqual(["Factura de suscripción sin aceptar en la DIAN"]);
    expect(describeSubscriptionInvoice(outcome)).toContain("REJECTED");
  });
});
