import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import PensionCalculator from "./pension-calculator"

const DEFAULTS = {
  name: "My plan",
  tierKey: "tier4",
  currentAge: 38,
  yos: 12,
  fas: 78000,
  investBalance: 65000,
  deferredComp: 40000,
  monthlyContrib: 600,
  desiredMonthlyIncome: 6500,
  growthRate: 6,
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/api/auth/signin")

  let scenarios = await prisma.pensionProfile.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  })

  // Every user has at least one scenario, so the calculator always has something to edit.
  if (scenarios.length === 0) {
    await prisma.pensionProfile.create({
      data: { userId: session.user.id, ...DEFAULTS },
    })
    scenarios = await prisma.pensionProfile.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
    })
  }

  return <PensionCalculator savedScenarios={scenarios} />
}
