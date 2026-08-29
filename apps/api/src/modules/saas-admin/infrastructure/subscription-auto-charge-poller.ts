import type { RunSubscriptionAutoChargesUseCase } from "../application/use-cases/run-subscription-auto-charges.use-case";

/**
 * Poller en proceso (setInterval), mismo patron y mismas limitaciones conocidas que
 * subscription-lifecycle-poller.ts (una instancia -- sin locking real si la API escalara
 * horizontalmente). Intervalo de 1 hora: RunSubscriptionAutoChargesUseCase ya se protege solo
 * contra reintentar el mismo dia (hasAutoChargeAttemptSince), asi que correr mas seguido no gana
 * nada.
 */
export function startSubscriptionAutoChargePoller(useCase: RunSubscriptionAutoChargesUseCase, intervalMs = 3_600_000): () => void {
  const timer = setInterval(() => {
    useCase.execute().catch((err) => {
      console.error("[subscription-auto-charge-poller] tick fallido:", err);
    });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
