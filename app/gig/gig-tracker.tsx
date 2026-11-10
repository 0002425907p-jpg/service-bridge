"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { addExpense, addIncome, addTrip, deleteEntry, saveSettings } from "./actions"
import {
  EXPENSE_CATEGORIES,
  FILING_LABELS,
  MILEAGE_RATE,
  QUARTER_DUE,
  estimateTax,
  type FilingStatus,
} from "@/lib/gig-tax"

type Trip = { id: string; date: string; miles: number; purpose: string }
type Expense = { id: string; date: string; category: string; description: string; amount: number }
type Income = { id: string; date: string; source: string; amount: number }
type Settings = { filingStatus: string; otherIncome: number; stateRate: number; withheld: number }

const usd = (n: number, digits = 0) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n)

const today = () => new Date().toISOString().slice(0, 10)

const input = "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
const btn = "rounded-md bg-[#16213D] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
const card = "rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"

type Tab = "summary" | "mileage" | "expenses" | "income"

export default function GigTracker(props: { trips: Trip[]; expenses: Expense[]; incomes: Income[]; settings: Settings }) {
  const [tab, setTab] = useState<Tab>("summary")
  const [year, setYear] = useState(new Date().getFullYear())
  const [error, setError] = useState("")
  const [pending, start] = useTransition()

  const inYear = <T extends { date: string }>(rows: T[]) => rows.filter((r) => r.date.startsWith(String(year)))
  const trips = inYear(props.trips)
  const expenses = inYear(props.expenses)
  const incomes = inYear(props.incomes)

  const years = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()])
    for (const r of [...props.trips, ...props.expenses, ...props.incomes]) set.add(Number(r.date.slice(0, 4)))
    return [...set].sort((a, b) => b - a)
  }, [props])

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError("")
    start(async () => {
      const r = await fn()
      if (!r.ok) setError(r.error ?? "Something went wrong")
      else after?.()
    })
  }

  const [s, setS] = useState(props.settings)
  const miles = trips.reduce((a, t) => a + t.miles, 0)
  const gross = incomes.reduce((a, t) => a + t.amount, 0)
  const exp = expenses.reduce((a, t) => a + t.amount, 0)
  const tax = estimateTax({
    grossIncome: gross,
    expenses: exp,
    miles,
    otherIncome: s.otherIncome,
    filingStatus: (s.filingStatus as FilingStatus) in FILING_LABELS ? (s.filingStatus as FilingStatus) : "single",
    stateRate: s.stateRate,
    withheld: s.withheld,
  })

  const [trip, setTrip] = useState({ date: today(), miles: "", purpose: "Amazon Hub delivery" })
  const [ex, setEx] = useState({ date: today(), category: EXPENSE_CATEGORIES[0], description: "", amount: "" })
  const [inc, setInc] = useState({ date: today(), source: "Amazon Hub", amount: "" })

  const Del = ({ kind, id }: { kind: "trip" | "expense" | "income"; id: string }) => (
    <button className="text-xs text-red-600 hover:underline" disabled={pending} onClick={() => run(() => deleteEntry(kind, id))}>
      Delete
    </button>
  )

  const tabs: [Tab, string][] = [["summary", "Taxes"], ["mileage", "Mileage"], ["expenses", "Expenses"], ["income", "Income"]]

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">1099 Tracker</h1>
        <Link href="/dashboard" className="text-sm underline">Pension planner</Link>
      </div>
      <p className="mb-4 text-sm text-neutral-500">Track Amazon Hub mileage, expenses and payouts, and see roughly what to set aside for taxes.</p>

      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm">Tax year</label>
        <select className="rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-700" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="mb-4 flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 text-sm ${tab === k ? "border-b-2 border-[#16213D] font-medium dark:border-white" : "text-neutral-500"}`}>
            {label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}

      {tab === "summary" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="1099 income" value={usd(gross)} />
            <Stat label="Mileage deduction" value={usd(tax.mileageDeduction)} sub={`${miles.toLocaleString()} mi × $${MILEAGE_RATE}`} />
            <Stat label="Expenses" value={usd(exp)} />
            <Stat label="Net profit" value={usd(tax.netProfit)} />
          </div>

          <div className={`${card} bg-neutral-50 dark:bg-neutral-900`}>
            <p className="text-sm text-neutral-500">Set aside from gig pay</p>
            <p className="text-3xl font-semibold">{usd(tax.gigTax)}</p>
            <p className="text-sm text-neutral-500">
              about {tax.setAsidePct.toFixed(0)}¢ of every $1 you&apos;re paid — {usd(tax.gigTax / 4)} per quarter
            </p>
          </div>

          <div className={card}>
            <h2 className="mb-2 text-sm font-medium">Breakdown</h2>
            <Row k="Self-employment tax (Social Security + Medicare)" v={usd(tax.seTax)} />
            <Row k="Federal income tax" v={usd(tax.federalIncomeTax)} />
            {s.stateRate > 0 && <Row k={`State tax (${s.stateRate}% flat)`} v={usd(tax.stateTax)} />}
            <Row k="Total tax for the year (all income)" v={usd(tax.totalTax)} bold />
            <Row k="Already paid / withheld" v={`− ${usd(s.withheld)}`} />
            <Row k={tax.owedAfterPaid >= 0 ? "Still to pay" : "Expected refund"} v={usd(Math.abs(tax.owedAfterPaid))} bold />
            <p className="mt-2 text-xs text-neutral-500">
              Includes the deduction for half of SE tax, the standard deduction and the 20% QBI deduction. Estimated payments are due {QUARTER_DUE.join(", ")}.
            </p>
          </div>

          <form
            className={`${card} grid gap-3 sm:grid-cols-2`}
            onSubmit={(e) => { e.preventDefault(); run(() => saveSettings(s)) }}
          >
            <h2 className="text-sm font-medium sm:col-span-2">Your tax situation</h2>
            <Field label="Filing status">
              <select className={input} value={s.filingStatus} onChange={(e) => setS({ ...s, filingStatus: e.target.value })}>
                {Object.entries(FILING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Other taxable income this year (W-2 job, etc.)">
              <input className={input} type="number" min="0" value={s.otherIncome} onChange={(e) => setS({ ...s, otherIncome: Number(e.target.value) })} />
            </Field>
            <Field label="State income tax rate (%) — rough flat estimate">
              <input className={input} type="number" min="0" max="20" step="0.1" value={s.stateRate} onChange={(e) => setS({ ...s, stateRate: Number(e.target.value) })} />
            </Field>
            <Field label="Tax already paid (W-2 withholding + quarterly payments)">
              <input className={input} type="number" min="0" value={s.withheld} onChange={(e) => setS({ ...s, withheld: Number(e.target.value) })} />
            </Field>
            <div className="sm:col-span-2"><button className={btn} disabled={pending}>Save</button></div>
          </form>
          <p className="text-xs text-neutral-500">Estimate only, using 2026 federal rules. Not tax advice — check with a tax professional or the IRS Form 1040-ES worksheet before paying.</p>
        </div>
      )}

      {tab === "mileage" && (
        <div className="space-y-4">
          <form className={`${card} grid gap-3 sm:grid-cols-4`} onSubmit={(e) => { e.preventDefault(); run(() => addTrip({ ...trip, miles: Number(trip.miles) }), () => setTrip({ ...trip, miles: "" })) }}>
            <Field label="Date"><input className={input} type="date" required value={trip.date} onChange={(e) => setTrip({ ...trip, date: e.target.value })} /></Field>
            <Field label="Miles"><input className={input} type="number" step="0.1" min="0.1" required value={trip.miles} onChange={(e) => setTrip({ ...trip, miles: e.target.value })} /></Field>
            <Field label="Purpose"><input className={input} value={trip.purpose} onChange={(e) => setTrip({ ...trip, purpose: e.target.value })} /></Field>
            <div className="flex items-end"><button className={btn} disabled={pending}>Add trip</button></div>
          </form>
          <p className="text-sm">{year} total: <b>{miles.toLocaleString()} mi</b> = <b>{usd(tax.mileageDeduction)}</b> deduction</p>
          <List empty="No trips yet.">
            {trips.map((t) => (
              <li key={t.id} className="flex justify-between gap-3 py-2 text-sm">
                <span>{t.date} · {t.purpose}</span>
                <span className="flex gap-3"><span>{t.miles} mi</span><Del kind="trip" id={t.id} /></span>
              </li>
            ))}
          </List>
          <p className="text-xs text-neutral-500">Count miles driven for the work itself (station to deliveries and back, between stops). Commuting from home to your first pickup generally doesn&apos;t count — ask a tax pro about your setup. Keep a log; the IRS wants date, miles and purpose. Don&apos;t also deduct gas or repairs if you use the standard mileage rate.</p>
        </div>
      )}

      {tab === "expenses" && (
        <div className="space-y-4">
          <form className={`${card} grid gap-3 sm:grid-cols-5`} onSubmit={(e) => { e.preventDefault(); run(() => addExpense({ ...ex, amount: Number(ex.amount) }), () => setEx({ ...ex, description: "", amount: "" })) }}>
            <Field label="Date"><input className={input} type="date" required value={ex.date} onChange={(e) => setEx({ ...ex, date: e.target.value })} /></Field>
            <Field label="Category">
              <select className={input} value={ex.category} onChange={(e) => setEx({ ...ex, category: e.target.value })}>
                {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Note"><input className={input} value={ex.description} onChange={(e) => setEx({ ...ex, description: e.target.value })} /></Field>
            <Field label="Amount ($)"><input className={input} type="number" step="0.01" min="0.01" required value={ex.amount} onChange={(e) => setEx({ ...ex, amount: e.target.value })} /></Field>
            <div className="flex items-end"><button className={btn} disabled={pending}>Add</button></div>
          </form>
          <p className="text-sm">{year} total: <b>{usd(exp, 2)}</b></p>
          <List empty="No expenses yet.">
            {expenses.map((x) => (
              <li key={x.id} className="flex justify-between gap-3 py-2 text-sm">
                <span>{x.date} · {x.category}{x.description && ` · ${x.description}`}</span>
                <span className="flex gap-3"><span>{usd(x.amount, 2)}</span><Del kind="expense" id={x.id} /></span>
              </li>
            ))}
          </List>
        </div>
      )}

      {tab === "income" && (
        <div className="space-y-4">
          <form className={`${card} grid gap-3 sm:grid-cols-4`} onSubmit={(e) => { e.preventDefault(); run(() => addIncome({ ...inc, amount: Number(inc.amount) }), () => setInc({ ...inc, amount: "" })) }}>
            <Field label="Date paid"><input className={input} type="date" required value={inc.date} onChange={(e) => setInc({ ...inc, date: e.target.value })} /></Field>
            <Field label="Source"><input className={input} value={inc.source} onChange={(e) => setInc({ ...inc, source: e.target.value })} /></Field>
            <Field label="Amount ($)"><input className={input} type="number" step="0.01" min="0.01" required value={inc.amount} onChange={(e) => setInc({ ...inc, amount: e.target.value })} /></Field>
            <div className="flex items-end"><button className={btn} disabled={pending}>Add payout</button></div>
          </form>
          <p className="text-sm">{year} total: <b>{usd(gross, 2)}</b></p>
          <List empty="No payouts yet.">
            {incomes.map((x) => (
              <li key={x.id} className="flex justify-between gap-3 py-2 text-sm">
                <span>{x.date} · {x.source}</span>
                <span className="flex gap-3"><span>{usd(x.amount, 2)}</span><Del kind="income" id={x.id} /></span>
              </li>
            ))}
          </List>
          <p className="text-xs text-neutral-500">Log the full amount before any fees. Gig income counts when paid, and you owe tax on it even if you never get a 1099.</p>
        </div>
      )}
    </main>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={card}>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      {sub && <p className="text-xs text-neutral-500">{sub}</p>}
    </div>
  )
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-1 text-sm ${bold ? "font-semibold" : ""}`}>
      <span>{k}</span><span>{v}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-neutral-500">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  )
}

function List({ children, empty }: { children: React.ReactNode[]; empty: string }) {
  if (children.length === 0) return <p className="text-sm text-neutral-500">{empty}</p>
  return <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">{children}</ul>
}
