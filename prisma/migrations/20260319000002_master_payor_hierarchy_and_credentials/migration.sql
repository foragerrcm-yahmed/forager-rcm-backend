-- Migration: Add payor hierarchy (parentId) to master_payors
--             and create provider_credentials table

-- Add parentId self-reference to master_payors
ALTER TABLE "master_payors"
  ADD COLUMN IF NOT EXISTS "parentId" TEXT;

ALTER TABLE "master_payors"
  ADD CONSTRAINT "master_payors_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "master_payors"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Create provider_credentials table
CREATE TABLE IF NOT EXISTS "provider_credentials" (
  "id"              TEXT NOT NULL,
  "providerId"      TEXT NOT NULL,
  "masterPayorId"   TEXT NOT NULL,
  "credentialType"  TEXT,
  "effectiveDate"   BIGINT,
  "expirationDate"  BIGINT,
  "notes"           TEXT,
  "organizationId"  TEXT NOT NULL,
  "createdById"     TEXT,
  "createdAt"       BIGINT NOT NULL DEFAULT 0,
  "updatedAt"       BIGINT NOT NULL DEFAULT 0,

  CONSTRAINT "provider_credentials_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_credentials_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "provider_credentials_masterPayorId_fkey"
    FOREIGN KEY ("masterPayorId") REFERENCES "master_payors"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "provider_credentials_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "provider_credentials_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "provider_credentials_unique"
    UNIQUE ("providerId", "masterPayorId", "organizationId")
);
