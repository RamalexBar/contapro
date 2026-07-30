import { app } from "./app";
import { env } from "./config/env";
import { startDianSubmissionPoller } from "./modules/electronic-invoicing/infrastructure/dian-submission-poller";
import {
  pollDianCreditNoteSubmissionsUseCase,
  pollDianDebitNoteSubmissionsUseCase,
  pollDianSubmissionsUseCase,
  pollDianSupportDocumentSubmissionsUseCase,
} from "./modules/electronic-invoicing/electronic-invoicing.container";

app.listen(env.PORT, () => {
  console.log(`ERP API escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

if (env.DIAN_CERTIFICATE_PATH) {
  startDianSubmissionPoller([
    pollDianSubmissionsUseCase,
    pollDianCreditNoteSubmissionsUseCase,
    pollDianDebitNoteSubmissionsUseCase,
    pollDianSupportDocumentSubmissionsUseCase,
  ]);
}
