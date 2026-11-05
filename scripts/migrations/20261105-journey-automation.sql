-- Additive and idempotent; existing journey documents remain readable.
CREATE TABLE IF NOT EXISTS "automation_heartbeats" (
  "id" TEXT PRIMARY KEY, "lastStartedAt" TIMESTAMP(3) NOT NULL,
  "lastFinishedAt" TIMESTAMP(3), "error" TEXT
);
CREATE TABLE IF NOT EXISTS "journey_entry_claims" (
  "id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "journeyId" TEXT NOT NULL,
  "checkoutKey" TEXT NOT NULL, "enrollmentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "journey_entry_claims_storeId_journeyId_checkoutKey_key"
 ON "journey_entry_claims"("storeId", "journeyId", "checkoutKey");
CREATE UNIQUE INDEX IF NOT EXISTS "journey_entry_claims_enrollmentId_key" ON "journey_entry_claims"("enrollmentId");

CREATE TABLE IF NOT EXISTS "whatsapp_receipt_docs" (
 "id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "phoneNumberId" TEXT NOT NULL,
 "data" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "whatsapp_receipt_docs_storeId_idx" ON "whatsapp_receipt_docs"("storeId");
