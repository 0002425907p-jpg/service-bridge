// Federal tax estimate for 1099 gig income (Amazon Hub etc.).
// Figures are for tax year 2026. Review them each January.
// This is an estimate, not tax advice.

export type FilingStatus = "single" | "mfj" | "hoh"

export const FILING_LABELS: Record<FilingStatus, string> = {
  single: "Single",
  mfj: "Married filing jointly",
  hoh: "Head of household",
}

/** IRS standard business mileage rate, dollars per mile. */
export const MILEAGE_RATE = 0.725
export const SS_WAGE_BASE = 184_500

const STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: 16_100,
  mfj: 32_200,
  hoh: 24_150,
}

// [upper bound of bracket, rate]
const BRACKETS: Record<FilingStatus, [number, number][]> = {
  single: [
    [12_400, 0.1],
    [50_400, 0.12],
    [105_700, 0.22],
    [201_775, 0.24],
    [256_225, 0.32],
    [640_600, 0.35],
    [Infinity, 0.37],
  ],
  mfj: [
    [24_800, 0.1],
    [100_800, 0.12],
    [211_400, 0.22],
    [403_550, 0.24],
    [512_450, 0.32],
    [768_700, 0.35],
    [Infinity, 0.37],
  ],
  hoh: [
    [17_700, 0.1],
    [67_450, 0.12],
    [105_700, 0.22],
    [201_750, 0.24],
    [256_200, 0.32],
    [640_600, 0.35],
    [Infinity, 0.37],
  ],
}

export function incomeTax(taxable: number, status: FilingStatus) {
  let tax = 0
  let lower = 0
  for (const [upper, rate] of BRACKETS[status]) {
    if (taxable > lower) tax += (Math.min(taxable, upper) - lower) * rate
    lower = upper
  }
  return tax
}

export type TaxInput = {
  grossIncome: number // 1099 payouts, dollars
  expenses: number // dollars
  miles: number
  otherIncome: number // W-2 / other taxable income, dollars
  filingStatus: FilingStatus
  stateRate: number // percent, flat estimate
  withheld: number // already paid: W-2 withholding + estimated payments
}

export function estimateTax(i: TaxInput) {
  const mileageDeduction = i.miles * MILEAGE_RATE
  const netProfit = Math.max(i.grossIncome - i.expenses - mileageDeduction, 0)

  // Self-employment tax: 15.3% on 92.35% of net profit (SS portion capped).
  const seBase = netProfit * 0.9235
  // Wages from a W-2 job use up the Social Security wage base first.
  const ssRoom = Math.max(SS_WAGE_BASE - i.otherIncome, 0)
  const seTax =
    netProfit < 400
      ? 0
      : Math.min(seBase, ssRoom) * 0.124 + seBase * 0.029
  const halfSe = seTax / 2

  const agi = i.otherIncome + netProfit - halfSe
  const std = STANDARD_DEDUCTION[i.filingStatus]
  const preQbi = Math.max(agi - std, 0)
  // 20% QBI deduction (ignores the high-income phase-out).
  const qbi = Math.min(0.2 * Math.max(netProfit - halfSe, 0), 0.2 * preQbi)
  const taxable = Math.max(preQbi - qbi, 0)

  const federalIncomeTax = incomeTax(taxable, i.filingStatus)
  const stateTax = Math.max(agi, 0) * (i.stateRate / 100)
  const totalTax = seTax + federalIncomeTax + stateTax
  // Share of the 1099 income to set aside: tax caused by the gig work alone.
  const baseline = estimateBaseline(i)
  const gigTax = Math.max(totalTax - baseline, 0)

  return {
    mileageDeduction,
    netProfit,
    seTax,
    qbi,
    taxable,
    federalIncomeTax,
    stateTax,
    totalTax,
    gigTax,
    setAsidePct: i.grossIncome > 0 ? (gigTax / i.grossIncome) * 100 : 0,
    owedAfterPaid: totalTax - i.withheld,
  }
}

/** Tax with no gig activity at all, so we can isolate what the gig work costs. */
function estimateBaseline(i: TaxInput) {
  const std = STANDARD_DEDUCTION[i.filingStatus]
  const taxable = Math.max(i.otherIncome - std, 0)
  return incomeTax(taxable, i.filingStatus) + Math.max(i.otherIncome, 0) * (i.stateRate / 100)
}

export const QUARTER_DUE = ["Apr 15", "Jun 15", "Sep 15", "Jan 15 (next year)"]

export const EXPENSE_CATEGORIES = [
  "Phone & data",
  "Parking & tolls",
  "Supplies",
  "Insurance",
  "Equipment",
  "Other",
]
