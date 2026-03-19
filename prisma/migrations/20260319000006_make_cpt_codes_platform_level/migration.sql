-- Migration: make CPT codes platform-level
-- CPT codes are now platform-wide (organizationId is nullable/optional).
-- CPTCodeRate keeps organizationId as required (rates are still per-org).
-- This allows the CMS seeder to seed rates for ALL orgs from a single set of platform codes.

-- 1. Make CPTCode.organizationId nullable
ALTER TABLE "cpt_codes" ALTER COLUMN "organizationId" DROP NOT NULL;

-- 2. Add FK from cpt_code_rates to organizations (if not already present)
-- The column already exists; just ensure the FK constraint is there.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'cpt_code_rates_organizationId_fkey'
      AND table_name = 'cpt_code_rates'
  ) THEN
    ALTER TABLE "cpt_code_rates"
      ADD CONSTRAINT "cpt_code_rates_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
