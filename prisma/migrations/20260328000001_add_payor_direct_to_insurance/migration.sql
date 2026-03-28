-- Add direct payorId to patient_insurances so eligibility checks work without a plan
ALTER TABLE "patient_insurances" ADD COLUMN "payorId" TEXT;

-- Backfill payorId from the linked plan's payorId for existing records
UPDATE "patient_insurances" pi
SET "payorId" = pp."payorId"
FROM "payor_plans" pp
WHERE pi."planId" = pp.id
  AND pi."payorId" IS NULL;

-- Add FK constraint
ALTER TABLE "patient_insurances"
  ADD CONSTRAINT "patient_insurances_payorId_fkey"
  FOREIGN KEY ("payorId") REFERENCES "payors"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
