-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('Forager', 'ForagerAPI', 'ForagerCSVUpload');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('Upcoming', 'Completed', 'Cancelled', 'NoShow');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('Pending', 'Submitted', 'Paid', 'Denied', 'ShortPaid', 'Overpaid');

-- CreateEnum
CREATE TYPE "EligibilityStatus" AS ENUM ('passed', 'failed', 'unchecked');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('Coinsurance', 'Copay', 'Deductible');

-- CreateEnum
CREATE TYPE "PayorType" AS ENUM ('Insurance', 'Patient');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('Cash', 'CreditCard', 'Check', 'Electronic');

-- CreateEnum
CREATE TYPE "VisitLocation" AS ENUM ('InClinic', 'Telehealth');

-- CreateEnum
CREATE TYPE "VisitType" AS ENUM ('FollowUp', 'NewPatient');

-- CreateEnum
CREATE TYPE "PolicyType" AS ENUM ('Primary', 'Secondary');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('Admin', 'Biller', 'Provider', 'FrontDesk');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" JSONB,
    "phone" TEXT,
    "email" TEXT,
    "npi" TEXT,
    "taxId" TEXT,
    "createdAt" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" BIGINT NOT NULL,
    "gender" TEXT,
    "ssn" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" JSONB,
    "organizationId" TEXT NOT NULL,
    "source" "DataSource" NOT NULL DEFAULT 'Forager',
    "createdAt" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "npi" TEXT,
    "specialty" TEXT,
    "organizationId" TEXT NOT NULL,
    "source" "DataSource" NOT NULL DEFAULT 'Forager',
    "createdAt" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payorId" TEXT NOT NULL,
    "planType" TEXT,
    "address" JSONB,
    "phone" TEXT,
    "createdAt" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "payors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "visitDate" BIGINT NOT NULL,
    "visitTime" BIGINT NOT NULL,
    "duration" INTEGER NOT NULL,
    "visitType" "VisitType" NOT NULL,
    "location" "VisitLocation" NOT NULL,
    "status" "VisitStatus" NOT NULL,
    "visitSource" TEXT,
    "clinicalNotes" TEXT,
    "followUpPlan" TEXT,
    "organizationId" TEXT NOT NULL,
    "source" "DataSource" NOT NULL DEFAULT 'Forager',
    "createdAt" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_policies" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "payorId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "groupNumber" TEXT,
    "policyType" "PolicyType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveDate" BIGINT NOT NULL,
    "terminationDate" BIGINT,
    "createdAt" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "insurance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claims" (
    "id" TEXT NOT NULL,
    "claimNumber" TEXT NOT NULL,
    "visitId" TEXT,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "payorId" TEXT NOT NULL,
    "serviceDate" BIGINT NOT NULL,
    "submissionDate" BIGINT,
    "creationDate" BIGINT NOT NULL DEFAULT 0,
    "billedAmount" DECIMAL(10,2) NOT NULL,
    "allowedAmount" DECIMAL(10,2),
    "paidAmount" DECIMAL(10,2),
    "adjustmentAmount" DECIMAL(10,2),
    "patientResponsibility" DECIMAL(10,2),
    "status" "ClaimStatus" NOT NULL,
    "denialCode" TEXT,
    "denialReason" TEXT,
    "notes" TEXT,
    "organizationId" TEXT NOT NULL,
    "source" "DataSource" NOT NULL DEFAULT 'Forager',
    "createdAt" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cpt_codes" (
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "standardPrice" DECIMAL(10,2) NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "cpt_codes_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "claim_services" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "cptCodeCode" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "contractedRate" DECIMAL(10,2),
    "modifiers" JSONB,
    "createdAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "claim_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_timelines" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "notes" TEXT,
    "createdAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "claim_timelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "claimId" TEXT,
    "visitId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerType" TEXT NOT NULL,
    "conditions" JSONB,
    "actions" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "flowData" JSONB,
    "organizationId" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_executions" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "executedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "rule_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "payors_payorId_key" ON "payors"("payorId");

-- CreateIndex
CREATE UNIQUE INDEX "claims_claimNumber_key" ON "claims"("claimNumber");

-- CreateIndex
CREATE UNIQUE INDEX "cpt_codes_code_key" ON "cpt_codes"("code");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_payorId_fkey" FOREIGN KEY ("payorId") REFERENCES "payors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_payorId_fkey" FOREIGN KEY ("payorId") REFERENCES "payors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_services" ADD CONSTRAINT "claim_services_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_services" ADD CONSTRAINT "claim_services_cptCodeCode_fkey" FOREIGN KEY ("cptCodeCode") REFERENCES "cpt_codes"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_timelines" ADD CONSTRAINT "claim_timelines_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_timelines" ADD CONSTRAINT "claim_timelines_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_executions" ADD CONSTRAINT "rule_executions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
