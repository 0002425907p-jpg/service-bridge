-- CreateTable
CREATE TABLE "PensionProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tierKey" TEXT NOT NULL DEFAULT 'tier4',
    "currentAge" INTEGER NOT NULL DEFAULT 38,
    "yos" INTEGER NOT NULL DEFAULT 12,
    "fas" INTEGER NOT NULL DEFAULT 78000,
    "investBalance" INTEGER NOT NULL DEFAULT 65000,
    "deferredComp" INTEGER NOT NULL DEFAULT 40000,
    "monthlyContrib" INTEGER NOT NULL DEFAULT 600,
    "desiredMonthlyIncome" INTEGER NOT NULL DEFAULT 6500,
    "growthRate" DOUBLE PRECISION NOT NULL DEFAULT 6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PensionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PensionProfile_userId_key" ON "PensionProfile"("userId");

-- AddForeignKey
ALTER TABLE "PensionProfile" ADD CONSTRAINT "PensionProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
