-- Add isActive to cpt_codes
ALTER TABLE "cpt_codes"
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Create diagnosis_codes master table
CREATE TABLE IF NOT EXISTS "diagnosis_codes" (
  "id"             TEXT NOT NULL,
  "code"           TEXT NOT NULL,
  "description"    TEXT NOT NULL,
  "category"       TEXT,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "organizationId" TEXT NOT NULL,
  "createdAt"      BIGINT NOT NULL DEFAULT 0,
  "updatedAt"      BIGINT NOT NULL DEFAULT 0,

  CONSTRAINT "diagnosis_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "diagnosis_codes_code_key" UNIQUE ("code"),
  CONSTRAINT "diagnosis_codes_code_organizationId_key" UNIQUE ("code", "organizationId"),
  CONSTRAINT "diagnosis_codes_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "diagnosis_codes_organizationId_idx"
  ON "diagnosis_codes"("organizationId");
