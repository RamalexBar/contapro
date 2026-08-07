import { app } from "./app";
import { env } from "./config/env";
import { startDianSubmissionPoller } from "./modules/electronic-invoicing/infrastructure/dian-submission-poller";
import {
  pollDianCreditNoteSubmissionsUseCase,
  pollDianDebitNoteSubmissionsUseCase,
  pollDianPayrollSubmissionsUseCase,
  pollDianSubmissionsUseCase,
  pollDianSupportDocumentSubmissionsUseCase,
} from "./modules/electronic-invoicing/electronic-invoicing.container";
import { startSubscriptionLifecyclePoller } from "./modules/saas-admin/infrastructure/subscription-lifecycle-poller";
import { runSubscriptionLifecycleUseCase } from "./modules/saas-admin/saas-admin.container";
import { startCollectionsReminderPoller } from "./modules/collections/infrastructure/collections-reminder-poller";
import { runCollectionsRemindersUseCase } from "./modules/collections/collections.container";
import { startRecurringInvoicePoller } from "./modules/recurring-invoices/infrastructure/recurring-invoice-poller";
import { runRecurringInvoicesUseCase } from "./modules/recurring-invoices/recurring-invoice.container";

app.listen(env.PORT, () => {
  console.log(`ERP API escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

if (env.DIAN_CERTIFICATE_PATH) {
  startDianSubmissionPoller([
    pollDianSubmissionsUseCase,
    pollDianCreditNoteSubmissionsUseCase,
    pollDianDebitNoteSubmissionsUseCase,
    pollDianSupportDocumentSubmissionsUseCase,
    pollDianPayrollSubmissionsUseCase,
  ]);
}

// A diferencia del poller DIAN, no depende de ningun certificado/config opcional -- arranca
// siempre (ver aviso de cabecera en subscription-lifecycle-poller.ts).
startSubscriptionLifecyclePoller(runSubscriptionLifecycleUseCase);

// Gateado por RESEND_API_KEY (igual criterio que el poller DIAN con su certificado): sin
// credenciales de Resend el poller no tiene nada util que hacer, ver
// resend-collection-reminder-notifier.ts.
if (env.RESEND_API_KEY) {
  startCollectionsReminderPoller(runCollectionsRemindersUseCase);
}

// Igual que el poller de suscripciones: no depende de ningun servicio externo, arranca siempre
// (ver aviso de cabecera en recurring-invoice-poller.ts).
startRecurringInvoicePoller(runRecurringInvoicesUseCase);
