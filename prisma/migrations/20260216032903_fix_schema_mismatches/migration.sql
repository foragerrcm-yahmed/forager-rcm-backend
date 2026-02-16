/*
  Warnings:

  - You are about to drop the column `createdAt` on the `attachments` table. All the data in the column will be lost.
  - You are about to drop the column `cptCodeCode` on the `claim_services` table. All the data in the column will be lost.
  - The primary key for the `cpt_codes` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `category` on the `cpt_codes` table. All the data in the column will be lost.
  - You are about to drop the column `standardPrice` on the `cpt_codes` table. All the data in the column will be lost.
  - Added the required column `cptCodeId` to the `claim_services` table without a default value. This is not possible if the table is not empty.
  - Added the required column `basePrice` to the `cpt_codes` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `cpt_codes` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `organizationId` to the `cpt_codes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdById` to the `rules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdById` to the `visits` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "claim_services" DROP CONSTRAINT "claim_services_cptCodeCode_fkey";

-- AlterTable
ALTER TABLE "attachments" DROP COLUMN "createdAt",
ADD COLUMN     "patientId" TEXT,
ADD COLUMN     "uploadedAt" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "claim_services" DROP COLUMN "cptCodeCode",
ADD COLUMN     "cptCodeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "cpt_codes" DROP CONSTRAINT "cpt_codes_pkey",
DROP COLUMN "category",
DROP COLUMN "standardPrice",
ADD COLUMN     "basePrice" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "organizationId" TEXT NOT NULL,
ADD COLUMN     "specialty" TEXT,
ADD CONSTRAINT "cpt_codes_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "rules" ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "updatedById" TEXT;

-- AlterTable
ALTER TABLE "visits" ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "updatedById" TEXT;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpt_codes" ADD CONSTRAINT "cpt_codes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_services" ADD CONSTRAINT "claim_services_cptCodeId_fkey" FOREIGN KEY ("cptCodeId") REFERENCES "cpt_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
