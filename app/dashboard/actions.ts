"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export type PensionInput = {
  tierKey: string
  currentAge: number
  yos: number
  fas: number
  investBalance: number
  deferredComp: number
  monthlyContrib: number
  desiredMonthlyIncome: number
  growthRate: number
}

const TIER_KEYS = ["tier4", "tier6"]

function clampInt(v: unknown, min: number, max: number, fallback: number) {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(n, min), max)
}

function clampFloat(v: unknown, min: number, max: number, fallback: number) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(n, min), max)
}

export async function savePensionProfile(input: PensionInput) {
  const session = await auth()
  if (!session?.user?.id) return { ok: false as const, error: "Not signed in" }

  const data = {
    tierKey: TIER_KEYS.includes(input.tierKey) ? input.tierKey : "tier4",
    currentAge: clampInt(input.currentAge, 16, 90, 38),
    yos: clampInt(input.yos, 0, 60, 12),
    fas: clampInt(input.fas, 0, 1_000_000, 78000),
    investBalance: clampInt(input.investBalance, 0, 100_000_000, 65000),
    deferredComp: clampInt(input.deferredComp, 0, 100_000_000, 40000),
    monthlyContrib: clampInt(input.monthlyContrib, 0, 1_000_000, 600),
    desiredMonthlyIncome: clampInt(input.desiredMonthlyIncome, 0, 1_000_000, 6500),
    growthRate: clampFloat(input.growthRate, 0, 30, 6),
  }

  try {
    await prisma.pensionProfile.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, ...data },
      update: data,
    })
    return { ok: true as const, savedAt: new Date().toISOString() }
  } catch {
    return { ok: false as const, error: "Could not save. Try again." }
  }
}
