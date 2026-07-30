import { basePrisma } from "@erp/database";
import { tenantStorage } from "../../../shared/context/request-context";
import type { PollDianSubmissionsUseCase } from "../application/use-cases/poll-dian-submissions.use-case";

/**
 * Poller en proceso (setInterval), sin infraestructura nueva -- este repo no tiene cola/cron
 * hoy. Intervalo de 30s elegido como valor razonable para el volumen de un POS, sin respaldo en
 * documentacion de limites de tasa de la DIAN (ajustar si hace falta).
 *
 * IMPORTANTE: el poller corre fuera de cualquier request HTTP, pero el aislamiento multi-tenant
 * (ver shared/prisma/tenant.extension.ts) depende de un TenantContext en AsyncLocalStorage para
 * poder consultar ElectronicInvoice. Por eso cada tanda itera las empresas activas y ejecuta el
 * caso de uso una vez POR EMPRESA, dentro de un contexto sintetico (`userId: "system"`, sin
 * usuario real de por medio -- el campo es nullable/sin FK en AuditLog, ver
 * modules/audit/domain/audit-log.repository.ts). Un fallo en una empresa no debe frenar a las
 * demas.
 *
 * LIMITACION CONOCIDA: si la API llega a correr en mas de una instancia (escalado horizontal),
 * cada instancia correria su propio poller y podria enviar la misma factura dos veces a la
 * DIAN, o duplicar el polling de estado. Aceptable para la etapa actual de instancia unica;
 * antes de escalar horizontalmente esto necesita un mecanismo con locking (ej. advisory lock de
 * Postgres) o una cola real -- deliberadamente no implementado ahora.
 */
async function runTickForAllCompanies(useCases: PollDianSubmissionsUseCase[]): Promise<void> {
  const companies = await basePrisma.company.findMany({ where: { isActive: true }, select: { id: true } });

  for (const { id: companyId } of companies) {
    await tenantStorage.run({ companyId, branchId: null, userId: "system", roles: [], permissions: new Set() }, async () => {
      // Un fallo en un tipo de documento (factura/nota credito/nota debito) no debe frenar los
      // demas -- cada uno se atrapa por separado.
      for (const useCase of useCases) {
        try {
          await useCase.execute();
        } catch (err) {
          console.error(`[dian-poller] tanda fallida para empresa ${companyId}:`, err);
        }
      }
    });
  }
}

/** `useCases`: una instancia de PollDianSubmissionsUseCase por tipo de documento (factura, nota
 * credito, nota debito) -- ver electronic-invoicing.container.ts. */
export function startDianSubmissionPoller(useCases: PollDianSubmissionsUseCase[], intervalMs = 30_000): () => void {
  const timer = setInterval(() => {
    runTickForAllCompanies(useCases).catch((err) => {
      console.error("[dian-poller] tick fallido:", err);
    });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
