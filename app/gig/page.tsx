import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import GigTracker from "./gig-tracker"

const iso = (d: Date) => d.toISOString().slice(0, 10)

export default async function GigPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/api/auth/signin")
  const userId = session.user.id

  const [trips, expenses, incomes, settings] = await Promise.all([
    prisma.mileageTrip.findMany({ where: { userId }, orderBy: { date: "desc" } }),
    prisma.gigExpense.findMany({ where: { userId }, orderBy: { date: "desc" } }),
    prisma.gigIncome.findMany({ where: { userId }, orderBy: { date: "desc" } }),
    prisma.gigSettings.findUnique({ where: { userId } }),
  ])

  return (
    <GigTracker
      trips={trips.map((t) => ({ id: t.id, date: iso(t.date), miles: t.miles, purpose: t.purpose }))}
      expenses={expenses.map((e) => ({ id: e.id, date: iso(e.date), category: e.category, description: e.description, amount: e.amountCents / 100 }))}
      incomes={incomes.map((x) => ({ id: x.id, date: iso(x.date), source: x.source, amount: x.amountCents / 100 }))}
      settings={{
        filingStatus: settings?.filingStatus ?? "single",
        otherIncome: (settings?.otherIncomeCents ?? 0) / 100,
        stateRate: settings?.stateRate ?? 0,
        withheld: (settings?.withheldCents ?? 0) / 100,
      }}
    />
  )
}
