import { basePrisma } from "@erp/database";
import { tenantStorage } from "../../../shared/context/request-context";
import type { RunCollectionsRemindersUseCase } from "../application/use-cases/run-collections-reminders.use-case";

/**
 * Poller en proceso (setInterval), mismo patron que dian-submission-poller.ts: AccountReceivable
 * es tenant-scoped (esta en TENANT_MODELS), asi que a diferencia del poller de suscripciones
 * (una sola query cross-tenant con basePrisma porque Subscription NO es tenant-scoped) este
 * itera las empresas activas y corre el caso de uso una vez POR EMPRESA dentro de un contexto
 * sintetico (`userId: "system"`). Un fallo en una empresa no debe frenar a las demas.
 */
async function runTickForAllCompanies(useCase: RunCollectionsRemindersUseCase): Promise<void> {
  const companies = await basePrisma.company.findMany({ where: { isActive: true }, select: { id: true } });

  for (const { id: companyId } of companies) {
    await tenantStorage.run({ companyId, branchId: null, userId: "system", roles: [], permissions: new Set() }, async () => {
      try {
        await useCase.execute();
      } catch (err) {
        console.error(`[collections-reminder-poller] tanda fallida para empresa ${companyId}:`, err);
      }
    });
  }
}

/** Intervalo de 1h -- mismo orden de magnitud que subscription-lifecycle-poller.ts (recordatorios
 * no necesitan la resolucion de segundos del poller de DIAN). */
export function startCollectionsReminderPoller(useCase: RunCollectionsRemindersUseCase, intervalMs = 3_600_000): () => void {
  const timer = setInterval(() => {
    runTickForAllCompanies(useCase).catch((err) => {
      console.error("[collections-reminder-poller] tick fallido:", err);
    });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
