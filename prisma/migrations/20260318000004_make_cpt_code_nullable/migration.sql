-- Make cptCodeCode nullable in claim_services (it was created as NOT NULL but schema says String?)
ALTER TABLE "claim_services" ALTER COLUMN "cptCodeCode" DROP NOT NULL;
