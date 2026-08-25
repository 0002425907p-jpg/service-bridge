-- DropIndex
DROP INDEX "PensionProfile_userId_key";

-- AlterTable
ALTER TABLE "PensionProfile" ADD COLUMN     "name" TEXT NOT NULL DEFAULT 'My plan';

-- CreateIndex
CREATE INDEX "PensionProfile_userId_idx" ON "PensionProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PensionProfile_userId_name_key" ON "PensionProfile"("userId", "name");

