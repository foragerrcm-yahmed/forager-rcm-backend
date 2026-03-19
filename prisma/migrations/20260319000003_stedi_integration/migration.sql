-- Migration: stedi_integration
-- Adds all fields and tables required for Stedi clearinghouse integration.

-- ── 1. ClaimStatus enum: add Pended value ────────────────────────────────────
ALTER TYPE "ClaimStatus" ADD VALUE IF NOT EXISTS 'Pended';

-- ── 2. Provider: add taxonomyCode ────────────────────────────────────────────
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "taxonomyCode" TEXT;

-- ── 3. Payor: add stediPayorId ───────────────────────────────────────────────
ALTER TABLE "payors" ADD COLUMN IF NOT EXISTS "stediPayorId" TEXT;

-- ── 4. Claim: add Stedi tracking fields ──────────────────────────────────────
ALTER TABLE "claims" ADD COLUMN IF NOT EXISTS "stediTransactionId" TEXT;
ALTER TABLE "claims" ADD COLUMN IF NOT EXISTS "stediStatus" TEXT;
ALTER TABLE "claims" ADD COLUMN IF NOT EXISTS "submittedToStediAt" TIMESTAMP(3);

-- ── 5. Diagnosis table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "diagnoses" (
    "id"          TEXT NOT NULL,
    "claimId"     TEXT,
    "visitId"     TEXT,
    "icdCode"     TEXT NOT NULL,
    "description" TEXT,
    "isPrimary"   BOOLEAN NOT NULL DEFAULT false,
    "sequence"    INTEGER NOT NULL DEFAULT 1,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnoses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "diagnoses_claimId_idx" ON "diagnoses"("claimId");
CREATE INDEX IF NOT EXISTS "diagnoses_visitId_idx" ON "diagnoses"("visitId");

ALTER TABLE "diagnoses"
    ADD CONSTRAINT "diagnoses_claimId_fkey"
    FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "diagnoses"
    ADD CONSTRAINT "diagnoses_visitId_fkey"
    FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 6. EligibilityCheck table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "eligibility_checks" (
    "id"                    TEXT NOT NULL,
    "patientId"             TEXT NOT NULL,
    "patientInsuranceId"    TEXT NOT NULL,
    "visitId"               TEXT,
    "organizationId"        TEXT NOT NULL,
    "stediTransactionId"    TEXT,
    "requestedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isEligible"            BOOLEAN,
    "coverageActive"        BOOLEAN,
    "planName"              TEXT,
    "groupNumber"           TEXT,
    "memberId"              TEXT,
    "copayAmount"           DECIMAL(10,2),
    "deductibleTotal"       DECIMAL(10,2),
    "deductibleMet"         DECIMAL(10,2),
    "deductibleRemaining"   DECIMAL(10,2),
    "oopTotal"              DECIMAL(10,2),
    "oopMet"                DECIMAL(10,2),
    "oopRemaining"          DECIMAL(10,2),
    "therapyVisitsAllowed"  INTEGER,
    "therapyVisitsUsed"     INTEGER,
    "therapyVisitsRemaining" INTEGER,
    "requiresAuthorization" BOOLEAN,
    "rawRequest"            JSONB,
    "rawResponse"           JSONB,
    "errorMessage"          TEXT,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eligibility_checks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "eligibility_checks_patientId_idx" ON "eligibility_checks"("patientId");
CREATE INDEX IF NOT EXISTS "eligibility_checks_patientInsuranceId_idx" ON "eligibility_checks"("patientInsuranceId");
CREATE INDEX IF NOT EXISTS "eligibility_checks_visitId_idx" ON "eligibility_checks"("visitId");
CREATE INDEX IF NOT EXISTS "eligibility_checks_organizationId_idx" ON "eligibility_checks"("organizationId");

ALTER TABLE "eligibility_checks"
    ADD CONSTRAINT "eligibility_checks_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "eligibility_checks"
    ADD CONSTRAINT "eligibility_checks_patientInsuranceId_fkey"
    FOREIGN KEY ("patientInsuranceId") REFERENCES "patient_insurances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 7. PaymentPosting table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "payment_postings" (
    "id"                    TEXT NOT NULL,
    "claimId"               TEXT NOT NULL,
    "organizationId"        TEXT NOT NULL,
    "checkNumber"           TEXT,
    "checkDate"             TIMESTAMP(3),
    "payerName"             TEXT,
    "payeeNpi"              TEXT,
    "billedAmount"          DECIMAL(10,2) NOT NULL,
    "allowedAmount"         DECIMAL(10,2),
    "paidAmount"            DECIMAL(10,2) NOT NULL,
    "patientResponsibility" DECIMAL(10,2),
    "adjustments"           JSONB,
    "claimAdjustmentReason" TEXT,
    "remarkCodes"           TEXT,
    "rawEraSegment"         JSONB,
    "postedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedById"            TEXT,
    "isAutoPosted"          BOOLEAN NOT NULL DEFAULT true,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_postings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payment_postings_claimId_idx" ON "payment_postings"("claimId");
CREATE INDEX IF NOT EXISTS "payment_postings_organizationId_idx" ON "payment_postings"("organizationId");

ALTER TABLE "payment_postings"
    ADD CONSTRAINT "payment_postings_claimId_fkey"
    FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 8. StediWebhookLog table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "stedi_webhook_logs" (
    "id"             TEXT NOT NULL,
    "eventType"      TEXT NOT NULL,
    "transactionId"  TEXT,
    "claimId"        TEXT,
    "organizationId" TEXT,
    "rawPayload"     JSONB NOT NULL,
    "processedAt"    TIMESTAMP(3),
    "error"          TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stedi_webhook_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "stedi_webhook_logs_transactionId_idx" ON "stedi_webhook_logs"("transactionId");
CREATE INDEX IF NOT EXISTS "stedi_webhook_logs_claimId_idx" ON "stedi_webhook_logs"("claimId");
CREATE INDEX IF NOT EXISTS "stedi_webhook_logs_organizationId_idx" ON "stedi_webhook_logs"("organizationId");
