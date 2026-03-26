-- DropForeignKey
ALTER TABLE "public"."claim_services" DROP CONSTRAINT "claim_services_cptCodeCode_fkey";

-- DropForeignKey
ALTER TABLE "public"."cpt_codes" DROP CONSTRAINT "cpt_codes_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."organizations" DROP CONSTRAINT "organizations_createdById_fkey";

-- DropForeignKey
ALTER TABLE "public"."provider_credentials" DROP CONSTRAINT "provider_credentials_masterPayorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."provider_credentials" DROP CONSTRAINT "provider_credentials_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."provider_credentials" DROP CONSTRAINT "provider_credentials_providerId_fkey";

-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "patientId" TEXT;

-- AlterTable
ALTER TABLE "cpt_codes" ALTER COLUMN "standardPrice" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "eligibility_checks" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payment_postings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "insurance_dependents" (
    "id" TEXT NOT NULL,
    "patientInsuranceId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" BIGINT,
    "relationship" TEXT,
    "createdAt" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "insurance_dependents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insurance_dependents_patientInsuranceId_idx" ON "insurance_dependents"("patientInsuranceId");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_dependents" ADD CONSTRAINT "insurance_dependents_patientInsuranceId_fkey" FOREIGN KEY ("patientInsuranceId") REFERENCES "patient_insurances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_masterPayorId_fkey" FOREIGN KEY ("masterPayorId") REFERENCES "master_payors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpt_codes" ADD CONSTRAINT "cpt_codes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_services" ADD CONSTRAINT "claim_services_cptCodeCode_fkey" FOREIGN KEY ("cptCodeCode") REFERENCES "cpt_codes"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "provider_credentials_unique" RENAME TO "provider_credentials_providerId_masterPayorId_organizationI_key";
