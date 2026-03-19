-- CreateTable: MasterPayor
-- Platform-managed canonical payor list seeded from Stedi's payer network.
-- Clients never interact with this table directly.
CREATE TABLE "master_payors" (
    "id"                  TEXT NOT NULL,
    "stediId"             TEXT NOT NULL,
    "displayName"         TEXT NOT NULL,
    "primaryPayorId"      TEXT NOT NULL,
    "aliases"             JSONB NOT NULL DEFAULT '[]',
    "avatarUrl"           TEXT,
    "coverageTypes"       JSONB NOT NULL DEFAULT '[]',
    "transactionSupport"  JSONB NOT NULL DEFAULT '{}',
    "isActive"            BOOLEAN NOT NULL DEFAULT true,
    "createdAt"           BIGINT NOT NULL DEFAULT 0,
    "updatedAt"           BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "master_payors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique stediId
CREATE UNIQUE INDEX "master_payors_stediId_key" ON "master_payors"("stediId");

-- AlterTable: add masterPayorId FK to payors
ALTER TABLE "payors" ADD COLUMN "masterPayorId" TEXT;

-- AddForeignKey: payors.masterPayorId -> master_payors.id
ALTER TABLE "payors" ADD CONSTRAINT "payors_masterPayorId_fkey"
    FOREIGN KEY ("masterPayorId") REFERENCES "master_payors"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
