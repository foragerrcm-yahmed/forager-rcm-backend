-- AlterTable: make planId nullable on patient_insurances
ALTER TABLE "patient_insurances" ALTER COLUMN "planId" DROP NOT NULL;
