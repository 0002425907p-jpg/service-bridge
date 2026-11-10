"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { EXPENSE_CATEGORIES } from "@/lib/gig-tax"

type Result = { ok: true } | { ok: false; error: string }

async function requireUserId() {
  const session = await auth()
  return session?.user?.id ?? null
}

function parseDate(raw: unknown) {
  const s = String(raw ?? "")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

function cents(raw: unknown) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}

function text(raw: unknown, max: number, fallback = "") {
  const s = String(raw ?? "").trim().replace(/\s+/g, " ").slice(0, max)
  return s || fallback
}


export async function addTrip(input: { date: string; miles: number; purpose: string }): Promise<Result> {
  const userId = await requireUserId()
  if (!userId) return { ok: false, error: "Not signed in" }
  const date = parseDate(input.date)
  const miles = Number(input.miles)
  if (!date) return { ok: false, error: "Pick a valid date" }
  if (!Number.isFinite(miles) || miles <= 0 || miles > 2000) return { ok: false, error: "Miles must be between 0 and 2,000" }
  await prisma.mileageTrip.create({
    data: { userId, date, miles: Math.round(miles * 10) / 10, purpose: text(input.purpose, 80, "Amazon Hub delivery") },
  })
  revalidatePath("/gig")
  return { ok: true }
}

export async function addExpense(input: { date: string; category: string; description: string; amount: number }): Promise<Result> {
  const userId = await requireUserId()
  if (!userId) return { ok: false, error: "Not signed in" }
  const date = parseDate(input.date)
  const amountCents = cents(input.amount)
  if (!date) return { ok: false, error: "Pick a valid date" }
  if (amountCents === null || amountCents <= 0 || amountCents > 100_000_000) return { ok: false, error: "Enter a valid amount" }
  const category = EXPENSE_CATEGORIES.includes(input.category) ? input.category : "Other"
  await prisma.gigExpense.create({
    data: { userId, date, category, description: text(input.description, 120), amountCents },
  })
  revalidatePath("/gig")
  return { ok: true }
}

export async function addIncome(input: { date: string; source: string; amount: number }): Promise<Result> {
  const userId = await requireUserId()
  if (!userId) return { ok: false, error: "Not signed in" }
  const date = parseDate(input.date)
  const amountCents = cents(input.amount)
  if (!date) return { ok: false, error: "Pick a valid date" }
  if (amountCents === null || amountCents <= 0 || amountCents > 1_000_000_000) return { ok: false, error: "Enter a valid amount" }
  await prisma.gigIncome.create({
    data: { userId, date, source: text(input.source, 60, "Amazon Hub"), amountCents },
  })
  revalidatePath("/gig")
  return { ok: true }
}

export async function deleteEntry(kind: "trip" | "expense" | "income", id: string): Promise<Result> {
  const userId = await requireUserId()
  if (!userId) return { ok: false, error: "Not signed in" }
  const where = { id: String(id), userId }
  if (kind === "trip") await prisma.mileageTrip.deleteMany({ where })
  else if (kind === "expense") await prisma.gigExpense.deleteMany({ where })
  else if (kind === "income") await prisma.gigIncome.deleteMany({ where })
  else return { ok: false, error: "Unknown entry type" }
  revalidatePath("/gig")
  return { ok: true }
}

export async function saveSettings(input: {
  filingStatus: string
  otherIncome: number
  stateRate: number
  withheld: number
}): Promise<Result> {
  const userId = await requireUserId()
  if (!userId) return { ok: false, error: "Not signed in" }
  const filingStatus = ["single", "mfj", "hoh"].includes(input.filingStatus) ? input.filingStatus : "single"
  const otherIncomeCents = Math.min(Math.max(cents(input.otherIncome) ?? 0, 0), 100_000_000_00)
  const withheldCents = Math.min(Math.max(cents(input.withheld) ?? 0, 0), 100_000_000_00)
  const stateRate = Math.min(Math.max(Number(input.stateRate) || 0, 0), 20)
  const data = { filingStatus, otherIncomeCents, withheldCents, stateRate }
  await prisma.gigSettings.upsert({ where: { userId }, create: { userId, ...data }, update: data })
  revalidatePath("/gig")
  return { ok: true }
}
