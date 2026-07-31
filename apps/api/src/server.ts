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
