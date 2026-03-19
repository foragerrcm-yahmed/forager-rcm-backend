-- Migration: cpt_code_rates
-- Adds per-taxonomy rate tiers to CPT codes.
-- When a claim service is created, the system looks up the rendering provider's
-- taxonomyCode and applies the matching tier rate instead of the base standardPrice.

CREATE TABLE IF NOT EXISTS "cpt_code_rates" (
    "id"              TEXT NOT NULL,
    "cptCodeCode"     TEXT NOT NULL,
    "taxonomyCode"    TEXT NOT NULL,
    "taxonomyLabel"   TEXT,
    "standardPrice"   DECIMAL(10,2) NOT NULL,
    "contractedPrice" DECIMAL(10,2),
    "notes"           TEXT,
    "organizationId"  TEXT NOT NULL,
    "createdAt"       BIGINT NOT NULL DEFAULT 0,
    "updatedAt"       BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "cpt_code_rates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cpt_code_rates_cptCodeCode_taxonomyCode_organizationId_key"
        UNIQUE ("cptCodeCode", "taxonomyCode", "organizationId")
);

CREATE INDEX IF NOT EXISTS "cpt_code_rates_cptCodeCode_idx" ON "cpt_code_rates"("cptCodeCode");
CREATE INDEX IF NOT EXISTS "cpt_code_rates_organizationId_idx" ON "cpt_code_rates"("organizationId");

ALTER TABLE "cpt_code_rates"
    ADD CONSTRAINT "cpt_code_rates_cptCodeCode_fkey"
    FOREIGN KEY ("cptCodeCode") REFERENCES "cpt_codes"("code") ON DELETE CASCADE ON UPDATE CASCADE;
