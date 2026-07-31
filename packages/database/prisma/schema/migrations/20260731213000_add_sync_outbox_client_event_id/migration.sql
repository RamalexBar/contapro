-- AlterTable
ALTER TABLE "sync_outbox" ADD COLUMN     "clientEventId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "errorMessage" TEXT,
ALTER COLUMN "entityId" DROP NOT NULL;

ALTER TABLE "sync_outbox" ALTER COLUMN "clientEventId" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "sync_outbox_companyId_clientEventId_key" ON "sync_outbox"("companyId", "clientEventId");
