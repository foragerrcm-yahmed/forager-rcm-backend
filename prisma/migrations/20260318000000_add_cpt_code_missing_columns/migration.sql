-- Add missing columns to cpt_codes table
-- specialty column (optional)
ALTER TABLE "cpt_codes" ADD COLUMN IF NOT EXISTS "specialty" TEXT;

-- basePrice column (optional Decimal)
ALTER TABLE "cpt_codes" ADD COLUMN IF NOT EXISTS "basePrice" DECIMAL(10,2);

-- organizationId column (required - add with default first, then add FK)
ALTER TABLE "cpt_codes" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- For existing rows (if any), set organizationId to the first organization
UPDATE "cpt_codes" SET "organizationId" = (SELECT id FROM "organizations" LIMIT 1) WHERE "organizationId" IS NULL;

-- Now make organizationId NOT NULL
ALTER TABLE "cpt_codes" ALTER COLUMN "organizationId" SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE "cpt_codes" ADD CONSTRAINT "cpt_codes_organizationId_fkey" 
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") 
  ON DELETE RESTRICT ON UPDATE CASCADE;
