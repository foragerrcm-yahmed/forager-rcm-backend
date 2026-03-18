-- AlterTable: Make Organization.createdById optional (nullable)
-- This allows creating an organization before a user exists (bootstrap scenario)
ALTER TABLE "organizations" ALTER COLUMN "createdById" DROP NOT NULL;
