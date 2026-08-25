import React, { useState, useMemo } from "react";

const TIERS = {
  tier4: {
    label: "Tier 4 (62/5 or 57/5 plan)",
    normalAge: 62,
    earlyAge: 55,
    earlyReductionPerYear: 0.06,
    rateBelow20: 0.0167,
    rateAt20Bonus: 0.02,
    rateAbove20: 0.02,
  },
  tier6: {
    label: "Tier 6",
    normalAge: 63,
    earlyAge: 55,
    earlyReductionPerYear: 0.065,
    rateBelow20: 0.0167,
    rateAt20Bonus: 0.0175,
    rateAbove20: 0.02,
  },
};

function estimateAnnualPension(fas, yos, tierKey) {
  const t = TIERS[tierKey];
  let pct;
  if (yos <= 20) {
    pct = t.rateBelow20 * yos;
  } else {
    pct = t.rateBelow20 * 20 + t.rateAbove20 * (yos - 20);
  }
  return Math.round(fas * pct);
}

function applyEarlyReduction(annualPension, retireAge, tierKey) {
  const t = TIERS[tierKey];
  if (retireAge >= t.normalAge) return annualPension;
  const yearsEarly = t.normalAge - retireAge;
  const reduction = Math.min(yearsEarly * t.earlyReductionPerYear, 0.9);
  return Math.round(annualPension * (1 - reduction));
}

function currency(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function PensionCalculator() {
  const [tierKey, setTierKey] = useState("tier4");
  const [currentAge, setCurrentAge] = useState(38);
  const [yos, setYos] = useState(12);
  const [fas, setFas] = useState(78000);
  const [investBalance, setInvestBalance] = useState(65000);
  const [deferredComp, setDeferredComp] = useState(40000);
  const [monthlyContrib, setMonthlyContrib] = useState(600);
  const [desiredMonthlyIncome, setDesiredMonthlyIncome] = useState(6500);
  const [growthRate, setGrowthRate] = useState(6);

  const tier = TIERS[tierKey];
  const yearsToNormal = Math.max(tier.normalAge - currentAge, 0);
  const yearsToEarly = Math.max(tier.earlyAge - currentAge, 0);
  const projectedYosAtNormal = yos + yearsToNormal;
  const projectedYosAtEarly = yos + yearsToEarly;

  const scenarios = useMemo(() => {
    const ages = [tier.earlyAge, tier.earlyAge + 5, tier.normalAge].filter(
      (a, i, arr) => arr.indexOf(a) === i && a >= currentAge
    );
    return ages.map((age) => {
      const yearsWorked = yos + (age - currentAge);
      const base = estimateAnnualPension(fas, yearsWorked, tierKey);
      const adjusted = applyEarlyReduction(base, age, tierKey);
      return { age, yearsWorked, annual: adjusted, monthly: Math.round(adjusted / 12) };
    });
  }, [currentAge, yos, fas, tierKey]);

  const normalScenario = scenarios[scenarios.length - 1];
  const pensionMonthly = normalScenario ? normalScenario.monthly : 0;
  const gapMonthly = Math.max(desiredMonthlyIncome - pensionMonthly, 0);
  const gapAnnual = gapMonthly * 12;
  const requiredPortfolio = Math.round(gapAnnual / 0.04);

  const yearsInvesting = yearsToNormal;
  const monthlyRate = growthRate / 100 / 12;
  const months = yearsInvesting * 12;
  const currentInvestTotal = investBalance + deferredComp;
  let futureValue = currentInvestTotal * Math.pow(1 + monthlyRate, months);
  if (monthlyRate > 0) {
    futureValue += monthlyContrib * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
  } else {
    futureValue += monthlyContrib * months;
  }
  futureValue = Math.round(futureValue);
  const onTrack = futureValue >= requiredPortfolio;
  const shortfall = Math.max(requiredPortfolio - futureValue, 0);

  const timelineMax = Math.max(30, projectedYosAtNormal + 2);
  const milestones = [
    { yos: 20, label: "20 yr" },
    { yos: tier.normalAge - currentAge + yos, label: `Normal (age ${tier.normalAge})` },
  ];

  const inkNavy = "#16213D";
  const brass = "#A67C3D";
  const paper = "#F2F1ED";
  const ledgerLine = "#D8DCE3";
  const green = "#3F6B4E";

  return (
    <div style={{ background: paper, minHeight: "100vh", padding: "32px 16px", fontFamily: "'Inter', system-ui, sans-serif", color: inkNavy }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>

        <div style={{ background: inkNavy, color: paper, borderRadius: 10, padding: "20px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 22, letterSpacing: 0.2 }}>Service &amp; Bridge</div>
            <div style={{ fontSize: 12.5, opacity: 0.75, marginTop: 2, letterSpacing: 0.4, textTransform: "uppercase" }}>Pension + investment planner for civil service</div>
          </div>
          <div style={{ width: 42, height: 42, borderRadius: "50%", border: `2px solid ${brass}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Lora', Georgia, serif", fontSize: 13, color: brass, flexShrink: 0 }}>
            {tierKey === "tier4" ? "T4" : "T6"}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div style={{ background: "#fff", border: `1px solid ${ledgerLine}`, borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 12.5, textTransform: "uppercase", letterSpacing: 0.5, color: "#6b7280", marginBottom: 14 }}>Pension inputs</div>

            <label style={labelStyle}>Retirement tier</label>
            <select value={tierKey} onChange={(e) => setTierKey(e.target.value)} style={inputStyle}>
              <option value="tier4">{TIERS.tier4.label}</option>
              <option value="tier6">{TIERS.tier6.label}</option>
            </select>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
              <div>
                <label style={labelStyle}>Current age</label>
                <input type="number" value={currentAge} onChange={(e) => setCurrentAge(Number(e.target.value))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Years of service</label>
                <input type="number" value={yos} onChange={(e) => setYos(Number(e.target.value))} style={inputStyle} />
              </div>
            </div>

            <label style={{ ...labelStyle, marginTop: 12 }}>Final average salary (FAS)</label>
            <input type="number" value={fas} onChange={(e) => setFas(Number(e.target.value))} style={inputStyle} />
          </div>

          <div style={{ background: "#fff", border: `1px solid ${ledgerLine}`, borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 12.5, textTransform: "uppercase", letterSpacing: 0.5, color: "#6b7280", marginBottom: 14 }}>Investment inputs</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelStyle}>Brokerage balance</label>
                <input type="number" value={investBalance} onChange={(e) => setInvestBalance(Number(e.target.value))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Deferred comp (457/403b)</label>
                <input type="number" value={deferredComp} onChange={(e) => setDeferredComp(Number(e.target.value))} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
              <div>
                <label style={labelStyle}>Monthly contribution</label>
                <input type="number" value={monthlyContrib} onChange={(e) => setMonthlyContrib(Number(e.target.value))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Growth rate (%/yr)</label>
                <input type="number" value={growthRate} onChange={(e) => setGrowthRate(Number(e.target.value))} style={inputStyle} />
              </div>
            </div>

            <label style={{ ...labelStyle, marginTop: 12 }}>Desired monthly retirement income</label>
            <input type="number" value={desiredMonthlyIncome} onChange={(e) => setDesiredMonthlyIncome(Number(e.target.value))} style={inputStyle} />
          </div>
        </div>

        <div style={{ background: "#fff", border: `1px solid ${ledgerLine}`, borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 12.5, textTransform: "uppercase", letterSpacing: 0.5, color: "#6b7280", marginBottom: 16 }}>Service timeline</div>
          <div style={{ position: "relative", height: 46 }}>
            <div style={{ position: "absolute", top: 20, left: 0, right: 0, height: 3, background: ledgerLine, borderRadius: 2 }} />
            <div style={{ position: "absolute", top: 20, left: 0, width: `${(yos / timelineMax) * 100}%`, height: 3, background: brass, borderRadius: 2 }} />
            {milestones.map((m, i) => (
              <div key={i} style={{ position: "absolute", left: `${Math.min((m.yos / timelineMax) * 100, 100)}%`, top: 0, transform: "translateX(-50%)", textAlign: "center" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: m.label.startsWith("Normal") ? green : inkNavy, margin: "0 auto" }} />
                <div style={{ fontSize: 10.5, color: "#6b7280", marginTop: 22, whiteSpace: "nowrap" }}>{m.label}</div>
              </div>
            ))}
            <div style={{ position: "absolute", left: `${(yos / timelineMax) * 100}%`, top: 20, transform: "translate(-50%, -50%)", width: 14, height: 14, borderRadius: "50%", background: inkNavy, border: "2px solid #fff", boxShadow: "0 0 0 1px " + inkNavy }} />
          </div>
          <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 10 }}>
            {yos} years served &middot; {yearsToNormal > 0 ? `${yearsToNormal} years to normal retirement (age ${tier.normalAge})` : "eligible for normal retirement"}
          </div>
        </div>

        <div style={{ background: "#fff", border: `1px solid ${ledgerLine}`, borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 12.5, textTransform: "uppercase", letterSpacing: 0.5, color: "#6b7280", marginBottom: 14 }}>Pension projections</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13.5 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${ledgerLine}` }}>
                <th style={thStyle}>Retire age</th>
                <th style={thStyle}>Years served</th>
                <th style={thStyle}>Annual pension</th>
                <th style={thStyle}>Monthly pension</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${ledgerLine}` }}>
                  <td style={tdStyle}>{s.age}</td>
                  <td style={tdStyle}>{s.yearsWorked}</td>
                  <td style={tdStyle}>{currency(s.annual)}</td>
                  <td style={tdStyle}>{currency(s.monthly)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 10 }}>
            Estimates only, based on a simplified tier formula. Confirm exact figures with NYCERS.
          </div>
        </div>

        <div style={{ background: inkNavy, color: paper, borderRadius: 10, padding: 24 }}>
          <div style={{ fontSize: 12.5, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.7, marginBottom: 16 }}>FI bridge — the gap pension doesn't cover</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 11.5, opacity: 0.65 }}>Desired income</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 19, marginTop: 4 }}>{currency(desiredMonthlyIncome)}/mo</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, opacity: 0.65 }}>Pension covers</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 19, marginTop: 4, color: brass }}>{currency(pensionMonthly)}/mo</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, opacity: 0.65 }}>Gap to fill</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 19, marginTop: 4 }}>{currency(gapMonthly)}/mo</div>
            </div>
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11.5, opacity: 0.65 }}>Portfolio needed (4% rule)</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, marginTop: 4 }}>{currency(requiredPortfolio)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, opacity: 0.65 }}>Projected at retirement</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, marginTop: 4, color: onTrack ? "#8FD4A8" : "#E8A0A0" }}>
                {currency(futureValue)}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16, fontSize: 13, padding: "10px 14px", borderRadius: 8, background: onTrack ? "rgba(143,212,168,0.15)" : "rgba(232,160,160,0.15)" }}>
            {onTrack
              ? `On track \u2014 projected balance covers the gap with ${currency(futureValue - requiredPortfolio)} to spare.`
              : `Short by ${currency(shortfall)}. Closing this over ${yearsInvesting} years needs roughly ${currency(Math.round(shortfall / Math.max(yearsInvesting, 1) / 12))} more per month, all else equal.`}
          </div>
        </div>

      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 12, color: "#6b7280", marginBottom: 4 };
const inputStyle = { width: "100%", boxSizing: "border-box", padding: "8px 10px", border: "1px solid #D8DCE3", borderRadius: 6, fontSize: 14, fontFamily: "inherit" };
const thStyle = { textAlign: "left", padding: "6px 8px", fontWeight: 500, color: "#6b7280", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.3 };
const tdStyle = { padding: "8px 8px" };
