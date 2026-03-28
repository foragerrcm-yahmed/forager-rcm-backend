-- AlterTable
-- Make planId optional on patient_insurances so policies can be saved without a specific plan selected.
ALTER TABLE "patient_insurances" ALTER COLUMN "planId" DROP NOT NULL;
