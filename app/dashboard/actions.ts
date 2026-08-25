"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export type ScenarioInput = {
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
const MAX_SCENARIOS = 8

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

function cleanName(raw: unknown, fallback: string) {
  const s = String(raw ?? "").trim().replace(/\s+/g, " ")
  if (!s) return fallback
  return s.slice(0, 40)
}

function normalize(input: ScenarioInput) {
  return {
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
}

async function requireUserId() {
  const session = await auth()
  return session?.user?.id ?? null
}

/** Save an existing scenario. Ownership is enforced via updateMany's where clause. */
export async function saveScenario(id: string, name: string, input: ScenarioInput) {
  const userId = await requireUserId()
  if (!userId) return { ok: false as const, error: "Not signed in" }

  const data = { ...normalize(input), name: cleanName(name, "My plan") }

  try {
    const res = await prisma.pensionProfile.updateMany({
      where: { id, userId },
      data,
    })
    if (res.count === 0) return { ok: false as const, error: "Scenario not found" }
    revalidatePath("/dashboard")
    return { ok: true as const }
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { ok: false as const, error: "You already have a scenario with that name" }
    }
    return { ok: false as const, error: "Could not save. Try again." }
  }
}

export async function createScenario(name: string, input: ScenarioInput) {
  const userId = await requireUserId()
  if (!userId) return { ok: false as const, error: "Not signed in" }

  const count = await prisma.pensionProfile.count({ where: { userId } })
  if (count >= MAX_SCENARIOS) {
    return { ok: false as const, error: `Limit is ${MAX_SCENARIOS} scenarios` }
  }

  try {
    const created = await prisma.pensionProfile.create({
      data: { userId, ...normalize(input), name: cleanName(name, `Plan ${count + 1}`) },
    })
    revalidatePath("/dashboard")
    return { ok: true as const, id: created.id }
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { ok: false as const, error: "You already have a scenario with that name" }
    }
    return { ok: false as const, error: "Could not create. Try again." }
  }
}

export async function deleteScenario(id: string) {
  const userId = await requireUserId()
  if (!userId) return { ok: false as const, error: "Not signed in" }

  const count = await prisma.pensionProfile.count({ where: { userId } })
  if (count <= 1) return { ok: false as const, error: "Keep at least one scenario" }

  const res = await prisma.pensionProfile.deleteMany({ where: { id, userId } })
  if (res.count === 0) return { ok: false as const, error: "Scenario not found" }
  revalidatePath("/dashboard")
  return { ok: true as const }
}
