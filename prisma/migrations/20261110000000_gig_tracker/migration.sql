-- CreateTable
CREATE TABLE "MileageTrip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "miles" DOUBLE PRECISION NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'Amazon Hub delivery',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MileageTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GigExpense" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GigExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GigIncome" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'Amazon Hub',
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GigIncome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GigSettings" (
    "userId" TEXT NOT NULL,
    "filingStatus" TEXT NOT NULL DEFAULT 'single',
    "otherIncomeCents" INTEGER NOT NULL DEFAULT 0,
    "stateRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "withheldCents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GigSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "MileageTrip_userId_date_idx" ON "MileageTrip"("userId", "date");

-- CreateIndex
CREATE INDEX "GigExpense_userId_date_idx" ON "GigExpense"("userId", "date");

-- CreateIndex
CREATE INDEX "GigIncome_userId_date_idx" ON "GigIncome"("userId", "date");

-- AddForeignKey
ALTER TABLE "MileageTrip" ADD CONSTRAINT "MileageTrip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GigExpense" ADD CONSTRAINT "GigExpense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GigIncome" ADD CONSTRAINT "GigIncome_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GigSettings" ADD CONSTRAINT "GigSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
