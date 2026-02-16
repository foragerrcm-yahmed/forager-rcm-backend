-- DropForeignKey
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_createdById_fkey";

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "createdById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
