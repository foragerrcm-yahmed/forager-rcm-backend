/*
  Warnings:

  - You are about to drop the column `address` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `taxId` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `payorId` on the `payors` table. All the data in the column will be lost.
  - You are about to drop the column `planType` on the `payors` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `providers` table. All the data in the column will be lost.
  - You are about to drop the `insurance_policies` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[externalPayorId]` on the table `payors` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `createdById` to the `organizations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdById` to the `patients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `billingTaxonomy` to the `payors` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdById` to the `payors` table without a default value. This is not possible if the table is not empty.
  - Added the required column `externalPayorId` to the `payors` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `payors` table without a default value. This is not possible if the table is not empty.
  - Added the required column `payorCategory` to the `payors` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdById` to the `providers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firstName` to the `providers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `providers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `licenseType` to the `providers` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProviderLicenseType" AS ENUM ('MD', 'DO', 'NP', 'PA_C', 'RN', 'LPN', 'PT', 'OT', 'DC', 'DPM', 'DDS', 'DMD', 'PharmD', 'PsyD', 'PhD', 'LCSW', 'LMFT', 'Other');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('PPO', 'HMO', 'EPO', 'POS', 'HDHP', 'Medicaid', 'Medicare', 'Other');

-- CreateEnum
CREATE TYPE "InsuredType" AS ENUM ('Subscriber', 'Dependent');

-- DropForeignKey
ALTER TABLE "public"."insurance_policies" DROP CONSTRAINT "insurance_policies_patientId_fkey";

-- DropForeignKey
ALTER TABLE "public"."insurance_policies" DROP CONSTRAINT "insurance_policies_payorId_fkey";

-- DropIndex
DROP INDEX "public"."payors_payorId_key";

-- AlterTable
ALTER TABLE "organizations" DROP COLUMN "address",
DROP COLUMN "taxId",
ADD COLUMN     "addresses" JSONB,
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "parentOrganizationId" TEXT,
ADD COLUMN     "updatedById" TEXT;

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "middleName" TEXT,
ADD COLUMN     "prefix" TEXT,
ADD COLUMN     "suffix" TEXT,
ADD COLUMN     "updatedById" TEXT,
ALTER COLUMN "source" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payors" DROP COLUMN "payorId",
DROP COLUMN "planType",
ADD COLUMN     "billingTaxonomy" TEXT NOT NULL,
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "externalPayorId" TEXT NOT NULL,
ADD COLUMN     "organizationId" TEXT NOT NULL,
ADD COLUMN     "payorCategory" TEXT NOT NULL,
ADD COLUMN     "portalUrl" TEXT,
ADD COLUMN     "updatedById" TEXT;

-- AlterTable
ALTER TABLE "providers" DROP COLUMN "name",
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "lastName" TEXT NOT NULL,
ADD COLUMN     "licenseType" "ProviderLicenseType" NOT NULL,
ADD COLUMN     "middleName" TEXT,
ADD COLUMN     "updatedById" TEXT,
ALTER COLUMN "source" DROP DEFAULT;

-- DropTable
DROP TABLE "public"."insurance_policies";

-- CreateTable
CREATE TABLE "patient_insurances" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL,
    "insuredType" "InsuredType" NOT NULL,
    "subscriberName" TEXT,
    "subscriberDob" BIGINT,
    "memberId" TEXT NOT NULL,
    "insuranceCardPath" TEXT,
    "createdAt" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "patient_insurances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payor_plans" (
    "id" TEXT NOT NULL,
    "payorId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "planType" "PlanType" NOT NULL,
    "isInNetwork" BOOLEAN NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "payor_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payors_externalPayorId_key" ON "payors"("externalPayorId");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_parentOrganizationId_fkey" FOREIGN KEY ("parentOrganizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_insurances" ADD CONSTRAINT "patient_insurances_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_insurances" ADD CONSTRAINT "patient_insurances_planId_fkey" FOREIGN KEY ("planId") REFERENCES "payor_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payors" ADD CONSTRAINT "payors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payors" ADD CONSTRAINT "payors_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payors" ADD CONSTRAINT "payors_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payor_plans" ADD CONSTRAINT "payor_plans_payorId_fkey" FOREIGN KEY ("payorId") REFERENCES "payors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
