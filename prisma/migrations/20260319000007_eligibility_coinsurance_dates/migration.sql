-- AddColumn coinsurancePercent, coverageStartDate, coverageEndDate to eligibility_checks
ALTER TABLE "eligibility_checks"
  ADD COLUMN IF NOT EXISTS "coinsurancePercent" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "coverageStartDate" TEXT,
  ADD COLUMN IF NOT EXISTS "coverageEndDate" TEXT;
