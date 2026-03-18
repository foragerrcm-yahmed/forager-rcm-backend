-- Add missing audit columns to claims table
ALTER TABLE "claims" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "claims" ADD COLUMN IF NOT EXISTS "updatedById" TEXT;

-- Add foreign key constraints
ALTER TABLE "claims" ADD CONSTRAINT "claims_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "claims" ADD CONSTRAINT "claims_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Add missing 'status' column to claim_timelines table
ALTER TABLE "claim_timelines" ADD COLUMN IF NOT EXISTS "status" TEXT;
