-- AlterTable: Add createdById and updatedById to visits
ALTER TABLE "visits" ADD COLUMN "createdById" TEXT;
ALTER TABLE "visits" ADD COLUMN "updatedById" TEXT;

-- AlterTable: Add createdById and updatedById to rules
ALTER TABLE "rules" ADD COLUMN "createdById" TEXT;
ALTER TABLE "rules" ADD COLUMN "updatedById" TEXT;

-- AddForeignKey: visits -> users (createdBy)
ALTER TABLE "visits" ADD CONSTRAINT "visits_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: visits -> users (updatedBy)
ALTER TABLE "visits" ADD CONSTRAINT "visits_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: rules -> users (createdBy)
ALTER TABLE "rules" ADD CONSTRAINT "rules_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: rules -> users (updatedBy)
ALTER TABLE "rules" ADD CONSTRAINT "rules_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
