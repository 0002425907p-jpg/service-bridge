import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import PensionCalculator from "./pension-calculator"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/api/auth/signin")

  const profile = await prisma.pensionProfile.findUnique({
    where: { userId: session.user.id },
  })

  return <PensionCalculator initial={profile} />
}
