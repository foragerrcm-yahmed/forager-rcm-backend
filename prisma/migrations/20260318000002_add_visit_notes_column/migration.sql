-- Add missing 'notes' column to visits table
ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "notes" TEXT;
