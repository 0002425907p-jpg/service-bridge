"use client";

import React, { useState, useMemo, useEffect } from "react";
import { saveScenario, createScenario, deleteScenario } from "./actions";

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

function summarize(s) {
  const t = TIERS[s.tierKey] ?? TIERS.tier4;
  const yearsToNormal = Math.max(t.normalAge - s.currentAge, 0);
  const yearsWorked = s.yos + yearsToNormal;
  const base = estimateAnnualPension(s.fas, yearsWorked, s.tierKey);
  const adjusted = applyEarlyReduction(base, t.normalAge, s.tierKey);
  const pensionMonthly = Math.round(adjusted / 12);
  return {
    retireAge: t.normalAge,
    pensionMonthly,
    gapMonthly: Math.max(s.desiredMonthlyIncome - pensionMonthly, 0),
  };
}

export default function PensionCalculator({ savedScenarios }) {
  const [list, setList] = useState(savedScenarios);
  const [activeId, setActiveId] = useState(savedScenarios[0]?.id ?? null);
  const active = list.find((s) => s.id === activeId) ?? list[0];

  const [name, setName] = useState(active?.name ?? "My plan");
  const [tierKey, setTierKey] = useState(active?.tierKey ?? "tier4");
  const [currentAge, setCurrentAge] = useState(active?.currentAge ?? 38);
  const [yos, setYos] = useState(active?.yos ?? 12);
  const [fas, setFas] = useState(active?.fas ?? 78000);
  const [investBalance, setInvestBalance] = useState(active?.investBalance ?? 65000);
  const [deferredComp, setDeferredComp] = useState(active?.deferredComp ?? 40000);
  const [monthlyContrib, setMonthlyContrib] = useState(active?.monthlyContrib ?? 600);
  const [desiredMonthlyIncome, setDesiredMonthlyIncome] = useState(active?.desiredMonthlyIncome ?? 6500);
  const [growthRate, setGrowthRate] = useState(active?.growthRate ?? 6);

  const [saveStatus, setSaveStatus] = useState("saved");
  const [saveError, setSaveError] = useState("");
  const [pending, setPending] = useState(false);
  const skipDirty = React.useRef(true);

  useEffect(() => {
    if (skipDirty.current) {
      skipDirty.current = false;
      return;
    }
    setSaveStatus("dirty");
    setSaveError("");
  }, [name, tierKey, currentAge, yos, fas, investBalance, deferredComp, monthlyContrib, desiredMonthlyIncome, growthRate]);

  const liveValues = {
    tierKey, currentAge, yos, fas, investBalance,
    deferredComp, monthlyContrib, desiredMonthlyIncome, growthRate,
  };

  function hydrate(s) {
    skipDirty.current = true;
    setActiveId(s.id);
    setName(s.name);
    setTierKey(s.tierKey);
    setCurrentAge(s.currentAge);
    setYos(s.yos);
    setFas(s.fas);
    setInvestBalance(s.investBalance);
    setDeferredComp(s.deferredComp);
    setMonthlyContrib(s.monthlyContrib);
    setDesiredMonthlyIncome(s.desiredMonthlyIncome);
    setGrowthRate(s.growthRate);
    setSaveStatus("saved");
    setSaveError("");
  }

  function switchTo(s) {
    if (s.id === activeId) return;
    if (saveStatus === "dirty" && !window.confirm("Discard unsaved changes to this scenario?")) return;
    hydrate(s);
  }

  async function handleSave() {
    if (!active) return;
    setSaveStatus("saving");
    setSaveError("");
    const res = await saveScenario(active.id, name, liveValues);
    if (res.ok) {
      setList((prev) => prev.map((s) => (s.id === active.id ? { ...s, ...liveValues, name } : s)));
      setSaveStatus("saved");
    } else {
      setSaveStatus("error");
      setSaveError(res.error || "Save failed");
    }
  }

  async function handleNew() {
    setPending(true);
    setSaveError("");
    const proposed = `Plan ${list.length + 1}`;
    const res = await createScenario(proposed, liveValues);
    setPending(false);
    if (res.ok) {
      const created = { id: res.id, name: proposed, ...liveValues };
      setList((prev) => [...prev, created]);
      hydrate(created);
    } else {
      setSaveError(res.error || "Could not create");
    }
  }

  async function handleDelete() {
    if (!active || list.length <= 1) return;
    if (!window.confirm(`Delete "${active.name}"? This cannot be undone.`)) return;
    setPending(true);
    setSaveError("");
    const res = await deleteScenario(active.id);
    setPending(false);
    if (res.ok) {
      const remaining = list.filter((s) => s.id !== active.id);
      setList(remaining);
      hydrate(remaining[0]);
    } else {
      setSaveError(res.error || "Could not delete");
    }
  }

  const compareRows = list
    .map((s) => (s.id === activeId ? { ...s, ...liveValues, name } : s))
    .map((s) => ({ id: s.id, name: s.name, ...summarize(s) }));

  const saveLabel = {
    dirty: "Save changes",
    saving: "Saving…",
    saved: "Saved ✓",
    error: "Retry save",
  }[saveStatus];

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
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
            <div style={{ textAlign: "right" }}>
              <button
                type="button"
                onClick={handleSave}
                disabled={saveStatus === "saving" || saveStatus === "saved"}
                style={{
                  padding: "9px 16px",
                  borderRadius: 6,
                  fontSize: 13.5,
                  fontFamily: "inherit",
                  cursor: saveStatus === "saving" || saveStatus === "saved" ? "default" : "pointer",
                  border: `1px solid ${brass}`,
                  background: saveStatus === "saved" ? "transparent" : brass,
                  color: saveStatus === "saved" ? brass : "#1b1b1b",
                  opacity: saveStatus === "saving" ? 0.7 : 1,
                }}
              >
                {saveLabel}
              </button>
              {saveError ? (
                <div style={{ fontSize: 11.5, color: "#E8A0A0", marginTop: 4 }}>{saveError}</div>
              ) : null}
            </div>
            <div style={{ width: 42, height: 42, borderRadius: "50%", border: `2px solid ${brass}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Lora', Georgia, serif", fontSize: 13, color: brass, flexShrink: 0 }}>
              {tierKey === "tier4" ? "T4" : "T6"}
            </div>
          </div>
        </div>

        <div style={{ background: "#fff", border: `1px solid ${ledgerLine}`, borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <div style={{ fontSize: 12.5, textTransform: "uppercase", letterSpacing: 0.5, color: "#6b7280" }}>
              Scenarios ({list.length}/8)
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={handleNew}
                disabled={pending || list.length >= 8}
                style={{ padding: "7px 13px", fontSize: 13, fontFamily: "inherit", borderRadius: 6, border: `1px solid ${ledgerLine}`, background: "#fff", color: inkNavy, cursor: pending || list.length >= 8 ? "default" : "pointer", opacity: pending || list.length >= 8 ? 0.45 : 1 }}
              >
                + Duplicate as new
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending || list.length <= 1}
                style={{ padding: "7px 13px", fontSize: 13, fontFamily: "inherit", borderRadius: 6, border: `1px solid ${ledgerLine}`, background: "#fff", color: list.length <= 1 ? "#9ca3af" : "#8c3b3b", cursor: pending || list.length <= 1 ? "default" : "pointer", opacity: pending || list.length <= 1 ? 0.45 : 1 }}
              >
                Delete
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {list.map((s) => {
              const isActive = s.id === activeId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => switchTo(s)}
                  style={{
                    padding: "7px 14px",
                    fontSize: 13,
                    fontFamily: "inherit",
                    borderRadius: 999,
                    cursor: isActive ? "default" : "pointer",
                    border: `1px solid ${isActive ? inkNavy : ledgerLine}`,
                    background: isActive ? inkNavy : "#fff",
                    color: isActive ? paper : inkNavy,
                  }}
                >
                  {isActive ? name || "Untitled" : s.name}
                  {isActive && saveStatus === "dirty" ? " •" : ""}
                </button>
              );
            })}
          </div>

          <label style={labelStyle}>Scenario name</label>
          <input
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />

          <div style={{ marginTop: 18, borderTop: `1px solid ${ledgerLine}`, paddingTop: 14 }}>
            <div style={{ fontSize: 12.5, textTransform: "uppercase", letterSpacing: 0.5, color: "#6b7280", marginBottom: 8 }}>Side by side</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 420 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Scenario</th>
                    <th style={thStyle}>Retire at</th>
                    <th style={thStyle}>Pension / mo</th>
                    <th style={thStyle}>Gap / mo</th>
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((r) => (
                    <tr key={r.id} style={{ borderTop: `1px solid ${ledgerLine}`, background: r.id === activeId ? "rgba(166,124,61,0.07)" : "transparent" }}>
                      <td style={tdStyle}>{r.name || "Untitled"}</td>
                      <td style={tdStyle}>{r.retireAge}</td>
                      <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums" }}>{currency(r.pensionMonthly)}</td>
                      <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums", color: r.gapMonthly > 0 ? "#8c3b3b" : green }}>
                        {r.gapMonthly > 0 ? currency(r.gapMonthly) : "covered"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
