import type { RunSubscriptionLifecycleUseCase } from "../application/use-cases/run-subscription-lifecycle.use-case";

/**
 * Poller en proceso (setInterval), mismo patron que
 * electronic-invoicing/infrastructure/dian-submission-poller.ts, pero mas simple: este job es
 * inherentemente transversal a todas las empresas (usa basePrisma directo en todo el modulo, ver
 * README), no hace falta sintetizar un TenantContext por empresa como si hace el poller DIAN.
 *
 * Intervalo de 1 hora: la logica es de granularidad de dias (recordatorios/vencimientos), no
 * hace falta mas frecuencia. Se arranca sin condicion en server.ts (a diferencia del poller DIAN,
 * no depende de ningun certificado/config opcional).
 *
 * LIMITACION CONOCIDA: si la API llega a correr en mas de una instancia, cada instancia correria
 * su propio poller -- mismo criterio ya aceptado para el poller DIAN (ver su cabecera), no
 * implementado aqui tampoco (locking real quedaria para cuando se escale horizontalmente).
 */
export function startSubscriptionLifecyclePoller(useCase: RunSubscriptionLifecycleUseCase, intervalMs = 3_600_000): () => void {
  const timer = setInterval(() => {
    useCase.execute().catch((err) => {
      console.error("[subscription-lifecycle-poller] tick fallido:", err);
    });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
