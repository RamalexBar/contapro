-- Agente de retencion (2026-11-24).
ALTER TABLE "companies" ADD COLUMN "withholdingAgent" BOOLEAN NOT NULL DEFAULT true;
