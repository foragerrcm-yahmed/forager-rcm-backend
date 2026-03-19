-- Migration: add planYearStartMonth to patient_insurances
-- Used for non-calendar-year plan deductible resets in shouldRecheckEligibility logic.

ALTER TABLE "patient_insurances"
  ADD COLUMN IF NOT EXISTS "planYearStartMonth" INTEGER;

COMMENT ON COLUMN "patient_insurances"."planYearStartMonth"
  IS '1-12 (January=1). NULL means calendar year reset (January). Set for employer plans that reset on a non-January date.';
