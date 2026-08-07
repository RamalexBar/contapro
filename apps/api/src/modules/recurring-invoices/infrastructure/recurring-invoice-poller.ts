import { basePrisma } from "@erp/database";
import { tenantStorage } from "../../../shared/context/request-context";
import type { RunRecurringInvoicesUseCase } from "../application/use-cases/run-recurring-invoices.use-case";

/**
 * Poller en proceso (setInterval), mismo patron que collections-reminder-poller.ts:
 * RecurringInvoice es tenant-scoped (esta en TENANT_MODELS), asi que itera las empresas activas y
 * corre el caso de uso una vez POR EMPRESA dentro de un contexto sintetico (`userId: "system"`).
 * Un fallo en una empresa no debe frenar a las demas.
 */
async function runTickForAllCompanies(useCase: RunRecurringInvoicesUseCase): Promise<void> {
  const companies = await basePrisma.company.findMany({ where: { isActive: true }, select: { id: true } });

  for (const { id: companyId } of companies) {
    await tenantStorage.run({ companyId, branchId: null, userId: "system", roles: [], permissions: new Set() }, async () => {
      try {
        await useCase.execute();
      } catch (err) {
        console.error(`[recurring-invoice-poller] tanda fallida para empresa ${companyId}:`, err);
      }
    });
  }
}

/** Intervalo de 1h -- no depende de ningun servicio externo (a diferencia del poller de cobranza,
 * gateado por RESEND_API_KEY), asi que arranca siempre, mismo criterio que
 * subscription-lifecycle-poller.ts. */
export function startRecurringInvoicePoller(useCase: RunRecurringInvoicesUseCase, intervalMs = 3_600_000): () => void {
  const timer = setInterval(() => {
    runTickForAllCompanies(useCase).catch((err) => {
      console.error("[recurring-invoice-poller] tick fallido:", err);
    });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
