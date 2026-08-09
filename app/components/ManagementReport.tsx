"use client";

import { useState, useMemo } from "react";
import type { FleetRow } from "../lib/types";
import { num, cr } from "../lib/dataUtils";

// ── Constants ───────────────────────────────────────────────────────────────

// Calendar year quarters: Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec
const QUARTER_MONTHS: Record<string, string[]> = {
  Q1: ["January", "February", "March"],
  Q2: ["April", "May", "June"],
  Q3: ["July", "August", "September"],
  Q4: ["October", "November", "December"],
};

function monthToQuarter(month: string): string | null {
  for (const [q, months] of Object.entries(QUARTER_MONTHS)) {
    if (months.includes(month)) return q;
  }
  return null;
}

/** "2025_Q3" → "Q3 2025" */
function quarterDisplayLabel(key: string): string {
  if (!key) return "—";
  const idx = key.lastIndexOf("_");
  if (idx === -1) return key;
  return `${key.slice(idx + 1)} ${key.slice(0, idx)}`;
}

interface QuarterKey {
  year: string;
  q: string;
}

function parseQuarterKey(key: string): QuarterKey | null {
  if (!key) return null;
  const idx = key.lastIndexOf("_");
  if (idx === -1) return null;
  return { year: key.slice(0, idx), q: key.slice(idx + 1) };
}

function filterByQuarter(data: FleetRow[], qk: QuarterKey): FleetRow[] {
  const months = QUARTER_MONTHS[qk.q];
  return data.filter((r) => r.Year === qk.year && months.includes(r.Month));
}

// ── Metrics ──────────────────────────────────────────────────────────────────

interface QMetrics {
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  fleetSize: number;
  activeCount: number;
  activePct: number;
  avgRevPerVehicle: number;
  totalKMS: number;
  nrk: number;
  revenueKMS: number;
  nrkRatio: number;
  revPerKm: number;
  costPerKm: number;
  profitPerKm: number;
  fuelCost: number;
  repairCost: number;
  chauffeurCost: number;
  emi: number;
  cdRevenue: number;
  sdRevenue: number;
  strRevenue: number;
  fuelPerVehicle: number;
  repairPerVehicle: number;
}

function computeMetrics(data: FleetRow[]): QMetrics {
  const revenue = data.reduce((s, r) => s + num(r["Total Revenue"]), 0);
  const cost = data.reduce((s, r) => s + num(r["Total Cost"]), 0);
  const profit = data.reduce((s, r) => s + num(r["Profit"]), 0);
  const uniqueVehicles = new Set(data.map((r) => r["Registration Number"])).size;
  const activeSet = new Set(
    data.filter((r) => num(r["Total Revenue"]) > 0).map((r) => r["Registration Number"])
  );
  const totalKMS = data.reduce((s, r) => s + num(r["Total KMS"]), 0);
  const nrk = data.reduce((s, r) => s + num(r["NRK"]), 0);
  const revenueKMS = data.reduce((s, r) => s + num(r["Revenue KMS"]), 0);
  const fuelCost = data.reduce((s, r) => s + num(r["Fuel Cost"]), 0);
  const repairCost = data.reduce((s, r) => s + num(r["Repair Cost"]), 0);
  return {
    revenue,
    cost,
    profit,
    margin: revenue > 0 ? (profit / revenue) * 100 : 0,
    fleetSize: uniqueVehicles,
    activeCount: activeSet.size,
    activePct: uniqueVehicles > 0 ? (activeSet.size / uniqueVehicles) * 100 : 0,
    avgRevPerVehicle: activeSet.size > 0 ? revenue / activeSet.size : 0,
    totalKMS,
    nrk,
    revenueKMS,
    nrkRatio: totalKMS > 0 ? (nrk / totalKMS) * 100 : 0,
    revPerKm: totalKMS > 0 ? revenue / totalKMS : 0,
    costPerKm: totalKMS > 0 ? cost / totalKMS : 0,
    profitPerKm: totalKMS > 0 ? profit / totalKMS : 0,
    fuelCost,
    repairCost,
    chauffeurCost: data.reduce((s, r) => s + num(r["Chauffeur Cost"]), 0),
    emi: data.reduce((s, r) => s + num(r["EMI"]), 0),
    cdRevenue: data.reduce((s, r) => s + num(r["CD Revenue"]), 0),
    sdRevenue: data.reduce((s, r) => s + num(r["SD Revenue"]), 0),
    strRevenue: data.reduce((s, r) => s + num(r["STR Revenue"]), 0),
    fuelPerVehicle: uniqueVehicles > 0 ? fuelCost / uniqueVehicles : 0,
    repairPerVehicle: uniqueVehicles > 0 ? repairCost / uniqueVehicles : 0,
  };
}

function pctDelta(a: number, b: number): number {
  if (a === 0) return b > 0 ? 100 : b < 0 ? -100 : 0;
  return ((b - a) / Math.abs(a)) * 100;
}

// ── Branch rows ───────────────────────────────────────────────────────────────

interface BranchRow {
  branch: string;
  revA: number;
  revB: number;
  profitA: number;
  profitB: number;
  marginA: number;
  marginB: number;
  activeA: number;
  activeB: number;
}

function computeBranchRows(dataA: FleetRow[], dataB: FleetRow[]): BranchRow[] {
  const branches = new Set([...dataA, ...dataB].map((r) => r.Branch).filter(Boolean));
  return [...branches]
    .map((branch) => {
      const ra = dataA.filter((r) => r.Branch === branch);
      const rb = dataB.filter((r) => r.Branch === branch);
      const revA = ra.reduce((s, r) => s + num(r["Total Revenue"]), 0);
      const revB = rb.reduce((s, r) => s + num(r["Total Revenue"]), 0);
      const profitA = ra.reduce((s, r) => s + num(r["Profit"]), 0);
      const profitB = rb.reduce((s, r) => s + num(r["Profit"]), 0);
      const costA = ra.reduce((s, r) => s + num(r["Total Cost"]), 0);
      const costB = rb.reduce((s, r) => s + num(r["Total Cost"]), 0);
      const activeA = new Set(ra.filter((r) => num(r["Total Revenue"]) > 0).map((r) => r["Registration Number"])).size;
      const activeB = new Set(rb.filter((r) => num(r["Total Revenue"]) > 0).map((r) => r["Registration Number"])).size;
      return {
        branch,
        revA, revB, profitA, profitB,
        marginA: revA > 0 ? (profitA / revA) * 100 : 0,
        marginB: revB > 0 ? (profitB / revB) * 100 : 0,
        activeA,
        activeB,
        // keep cost for reference
        _costA: costA, _costB: costB,
      };
    })
    .sort((a, b) => b.revB - a.revB) as BranchRow[];
}

// ── Model rows ───────────────────────────────────────────────────────────────

interface ModelRow {
  model: string;
  revA: number;
  revB: number;
  profitA: number;
  profitB: number;
  countA: number;
  countB: number;
  avgRevA: number;
  avgRevB: number;
  marginA: number;
  marginB: number;
  kmsA: number;
  kmsB: number;
}

function computeModelRows(dataA: FleetRow[], dataB: FleetRow[]): ModelRow[] {
  const models = new Set([...dataA, ...dataB].map((r) => r.Model).filter(Boolean));
  return [...models]
    .map((model) => {
      const ra = dataA.filter((r) => r.Model === model);
      const rb = dataB.filter((r) => r.Model === model);
      const revA = ra.reduce((s, r) => s + num(r["Total Revenue"]), 0);
      const revB = rb.reduce((s, r) => s + num(r["Total Revenue"]), 0);
      const profitA = ra.reduce((s, r) => s + num(r["Profit"]), 0);
      const profitB = rb.reduce((s, r) => s + num(r["Profit"]), 0);
      const costA = ra.reduce((s, r) => s + num(r["Total Cost"]), 0);
      const costB = rb.reduce((s, r) => s + num(r["Total Cost"]), 0);
      const countA = new Set(ra.map((r) => r["Registration Number"])).size;
      const countB = new Set(rb.map((r) => r["Registration Number"])).size;
      return {
        model,
        revA, revB, profitA, profitB,
        countA, countB,
        avgRevA: countA > 0 ? revA / countA : 0,
        avgRevB: countB > 0 ? revB / countB : 0,
        marginA: revA > 0 ? (profitA / revA) * 100 : 0,
        marginB: revB > 0 ? (profitB / revB) * 100 : 0,
        kmsA: ra.reduce((s, r) => s + num(r["Total KMS"]), 0),
        kmsB: rb.reduce((s, r) => s + num(r["Total KMS"]), 0),
        _costA: costA, _costB: costB,
      };
    })
    .sort((a, b) => b.revB - a.revB) as ModelRow[];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DeltaBadge({ val, invert = false, suffix = "%" }: { val: number; invert?: boolean; suffix?: string }) {
  const good = invert ? val < 0 : val > 0;
  const neutral = Math.abs(val) < 0.1;
  const color = neutral ? "#6b7280" : good ? "#16a34a" : "#dc2626";
  const bg = neutral ? "#f3f4f6" : good ? "#dcfce7" : "#fee2e2";
  return (
    <span style={{ background: bg, color, fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 2, whiteSpace: "nowrap" }}>
      {val > 0.1 ? "▲" : val < -0.1 ? "▼" : "—"} {Math.abs(val).toFixed(1)}{suffix}
    </span>
  );
}

function SectionCard({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid var(--border)", padding: "24px 28px", marginBottom: 20, ...style }}>
      <h3 className="syne" style={{ fontSize: 15, fontWeight: 700, color: "#0f1c2e", marginBottom: 18 }}>{title}</h3>
      {children}
    </div>
  );
}

function MiniBar({ val, max, color }: { val: number; max: number; color: string }) {
  return (
    <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden", width: "100%", minWidth: 60 }}>
      <div style={{ height: "100%", width: `${Math.min((val / Math.max(max, 1)) * 100, 100)}%`, background: color, borderRadius: 3, transition: "width 0.5s ease" }} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  allData: FleetRow[];
}

export default function ManagementReport({ allData }: Props) {
  const [quarterA, setQuarterA] = useState("");
  const [quarterB, setQuarterB] = useState("");
  const [filterBranch, setFilterBranch] = useState("all");

  const availableBranches = useMemo(() => {
    const bs = new Set(allData.map((r) => r.Branch).filter(Boolean));
    return ["all", ...[...bs].sort()];
  }, [allData]);

  const availableQuarters = useMemo(() => {
    const set = new Set<string>();
    allData.forEach((r) => {
      if (!r.Month || !r.Year) return;
      const q = monthToQuarter(r.Month);
      if (q) set.add(`${r.Year}_${q}`);
    });
    return [...set].sort((a, b) => {
      const ya = a.slice(0, a.lastIndexOf("_")), qa = a.slice(a.lastIndexOf("_") + 1);
      const yb = b.slice(0, b.lastIndexOf("_")), qb = b.slice(b.lastIndexOf("_") + 1);
      return ya !== yb ? ya.localeCompare(yb) : qa.localeCompare(qb);
    });
  }, [allData]);

  const qkA = useMemo(() => parseQuarterKey(quarterA), [quarterA]);
  const qkB = useMemo(() => parseQuarterKey(quarterB), [quarterB]);

  const branchFiltered = useMemo(
    () => filterBranch === "all" ? allData : allData.filter((r) => r.Branch === filterBranch),
    [allData, filterBranch]
  );

  const dataA = useMemo(() => (qkA ? filterByQuarter(branchFiltered, qkA) : []), [branchFiltered, qkA]);
  const dataB = useMemo(() => (qkB ? filterByQuarter(branchFiltered, qkB) : []), [branchFiltered, qkB]);

  const mA = useMemo(() => computeMetrics(dataA), [dataA]);
  const mB = useMemo(() => computeMetrics(dataB), [dataB]);
  const branchRows = useMemo(() => computeBranchRows(dataA, dataB), [dataA, dataB]);
  const modelRows = useMemo(() => computeModelRows(dataA, dataB), [dataA, dataB]);

  const sameQuarter = quarterA && quarterB && quarterA === quarterB;
  const showReport = !sameQuarter && qkA && qkB && dataA.length > 0 && dataB.length > 0;

  const labelA = quarterA ? quarterDisplayLabel(quarterA) : "—";
  const labelB = quarterB ? quarterDisplayLabel(quarterB) : "—";

  const insights = useMemo(() => {
    if (!showReport) return { wins: [], challenges: [], recommendations: [] };

    const revDelta = pctDelta(mA.revenue, mB.revenue);
    const profDelta = pctDelta(mA.profit, mB.profit);
    const marginDelta = mB.margin - mA.margin;
    const actDelta = mB.activePct - mA.activePct;
    const repairDelta = pctDelta(mA.repairCost, mB.repairCost);
    const chauffeurDelta = pctDelta(mA.chauffeurCost, mB.chauffeurCost);
    const nrkDelta = mB.nrkRatio - mA.nrkRatio;
    const revKmDelta = pctDelta(mA.revPerKm, mB.revPerKm);

    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const bigGainer = [...branchRows].sort((a, b) => pctDelta(a.revA, a.revB) < pctDelta(b.revA, b.revB) ? 1 : -1)[0];
    const bigLoser = [...branchRows].sort((a, b) => pctDelta(a.revA, a.revB) > pctDelta(b.revA, b.revB) ? 1 : -1)[0];
    const topModel = modelRows[0];
    const worstModel = [...modelRows].sort((a, b) => pctDelta(a.revA, a.revB) - pctDelta(b.revA, b.revB))[0];

    const wins: string[] = [];
    const challenges: string[] = [];
    const recommendations: string[] = [];

    // Wins
    if (revDelta > 5) wins.push(`Revenue grew ${revDelta.toFixed(1)}% in ${labelB}, reflecting stronger market capture.`);
    if (profDelta > 5) wins.push(`Net profit improved ${profDelta.toFixed(1)}%, demonstrating better cost discipline.`);
    if (marginDelta > 0.5) wins.push(`Profit margin expanded ${marginDelta.toFixed(1)}pp to ${mB.margin.toFixed(1)}%.`);
    if (actDelta > 1) wins.push(`Fleet utilisation improved — active vehicle rate rose ${actDelta.toFixed(1)}pp to ${mB.activePct.toFixed(1)}%.`);
    if (revKmDelta > 3) wins.push(`Revenue per KM improved ${revKmDelta.toFixed(1)}%, indicating better route monetisation.`);
    if (nrkDelta < -2) wins.push(`Non-revenue KM ratio dropped ${Math.abs(nrkDelta).toFixed(1)}pp — less idle driving.`);
    if (bigGainer && pctDelta(bigGainer.revA, bigGainer.revB) > 8)
      wins.push(`${cap(bigGainer.branch)} was the top growth branch, up ${pctDelta(bigGainer.revA, bigGainer.revB).toFixed(1)}% QoQ.`);
    if (topModel && pctDelta(topModel.revA, topModel.revB) > 8)
      wins.push(`${topModel.model} led model growth at +${pctDelta(topModel.revA, topModel.revB).toFixed(1)}%.`);

    // Challenges
    if (revDelta < -5) challenges.push(`Revenue declined ${Math.abs(revDelta).toFixed(1)}% — booking pipeline requires immediate review.`);
    if (profDelta < -5) challenges.push(`Profitability eroded ${Math.abs(profDelta).toFixed(1)}% — costs outpacing revenue.`);
    if (marginDelta < -1) challenges.push(`Margins compressed ${Math.abs(marginDelta).toFixed(1)}pp to ${mB.margin.toFixed(1)}%.`);
    if (actDelta < -2) challenges.push(`Fleet utilisation dropped ${Math.abs(actDelta).toFixed(1)}pp — more vehicles sitting idle.`);
    if (repairDelta > 15) challenges.push(`Repair & maintenance costs spiked ${repairDelta.toFixed(1)}% — vehicle ageing may be a factor.`);
    if (nrkDelta > 2) challenges.push(`Non-revenue KM ratio rose ${nrkDelta.toFixed(1)}pp — more unproductive driving.`);
    if (bigLoser && pctDelta(bigLoser.revA, bigLoser.revB) < -8)
      challenges.push(`${cap(bigLoser.branch)} saw the steepest decline at ${Math.abs(pctDelta(bigLoser.revA, bigLoser.revB)).toFixed(1)}% QoQ.`);
    if (worstModel && pctDelta(worstModel.revA, worstModel.revB) < -10)
      challenges.push(`${worstModel.model} underperformed most, down ${Math.abs(pctDelta(worstModel.revA, worstModel.revB)).toFixed(1)}% QoQ.`);
    if (mB.nrkRatio > 20) challenges.push(`${mB.nrkRatio.toFixed(1)}% of all KMs driven are non-revenue — operational efficiency needs attention.`);

    // Recommendations
    if (revDelta < 0) recommendations.push("Run a branch-level booking pipeline audit to identify stalled demand and reactivate key accounts.");
    if (mB.activePct < 80) recommendations.push(`${(100 - mB.activePct).toFixed(0)}% of fleet is idle — prioritise reassignment or short-term deployment of dormant vehicles.`);
    if (repairDelta > 10) recommendations.push("Introduce preventive maintenance scheduling to prevent escalating repair costs from becoming structural.");
    if (mB.margin < 15) recommendations.push(`Margin of ${mB.margin.toFixed(1)}% is thin — review pricing tiers and renegotiate high-spend cost categories.`);
    if (bigLoser && pctDelta(bigLoser.revA, bigLoser.revB) < -10)
      recommendations.push(`Initiate a root-cause review for ${cap(bigLoser.branch)} — understand demand-side vs operational drivers before next quarter.`);
    if (chauffeurDelta > 10) recommendations.push("Chauffeur costs rising — audit driver allocation, overtime patterns, and headcount vs operational need.");
    if (mB.nrkRatio > 15) recommendations.push("Reduce non-revenue KM through better trip scheduling, route optimisation, and deadhead reduction policies.");
    if (worstModel && pctDelta(worstModel.revA, worstModel.revB) < -10)
      recommendations.push(`Evaluate utilisation strategy for ${worstModel.model} — redeployment to higher-demand routes or segments may improve returns.`);
    recommendations.push("Systematise best practices from top branches and build a quarterly cross-branch performance review cadence.");

    return { wins, challenges, recommendations };
  }, [showReport, mA, mB, branchRows, modelRows, labelB]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxBranchRev = Math.max(...branchRows.map((b) => Math.max(b.revA, b.revB)), 1);
  const maxModelRev = Math.max(...modelRows.map((m) => Math.max(m.revA, m.revB)), 1);

  const selectStyle: React.CSSProperties = {
    padding: "9px 36px 9px 14px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    fontSize: 13,
    fontWeight: 600,
    color: "#0f1c2e",
    background: "#f8fafc",
    minWidth: 180,
    cursor: "pointer",
    appearance: "none",
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b7280' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
  };

  return (
    <div style={{ fontFamily: "inherit" }}>

      {/* ── Quarter selector ── */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid var(--border)", padding: "24px 28px", marginBottom: 24 }}>
        <h2 className="syne" style={{ fontSize: 20, fontWeight: 800, color: "#0f1c2e", marginBottom: 4 }}>
          Management Report
        </h2>
        <p style={{ fontSize: 13, color: "var(--text3)", marginBottom: 20 }}>
          Select two quarters to generate a detailed comparative performance report.
        </p>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          {[
            { label: "Base Quarter", value: quarterA, onChange: setQuarterA },
            { label: "Comparison Quarter", value: quarterB, onChange: setQuarterB },
          ].map(({ label, value, onChange }, i) => (
            <div key={i}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {label}
              </label>
              <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
                <option value="">— Select —</option>
                {availableQuarters.map((q) => (
                  <option key={q} value={q}>{quarterDisplayLabel(q)}</option>
                ))}
              </select>
            </div>
          ))}
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text3)", paddingBottom: 10 }}>vs</div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Branch
            </label>
            <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} style={selectStyle}>
              {availableBranches.map((b) => (
                <option key={b} value={b}>
                  {b === "all" ? "All Branches" : b.charAt(0).toUpperCase() + b.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {sameQuarter && (
          <p style={{ marginTop: 12, fontSize: 12, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 12px", display: "inline-block" }}>
            Both quarters are the same — select two different quarters.
          </p>
        )}
        {!sameQuarter && quarterA && quarterB && (dataA.length === 0 || dataB.length === 0) && (
          <p style={{ marginTop: 12, fontSize: 12, color: "#dc2626" }}>No data found for one or both selected quarters.</p>
        )}
      </div>

      {/* ── Empty state ── */}
      {!quarterA && !quarterB && (
        <div style={{ textAlign: "center", padding: "72px 20px", color: "var(--text3)" }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Select Two Quarters to Begin</div>
          <div style={{ fontSize: 13 }}>Choose a base and a comparison quarter above to generate the report.</div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          REPORT
      ══════════════════════════════════════════════════════════════════════ */}
      {showReport && (
        <>
          {/* ── Header banner ── */}
          <div style={{ background: "linear-gradient(135deg, #0f1c2e 0%, #1e3a5f 55%, #2d5a8e 100%)", borderRadius: 16, padding: "28px 32px", marginBottom: 20, color: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
                  Quarterly Management Report · Autoriders Fleet Intelligence
                </div>
                <h2 className="syne" style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.5px" }}>
                  {labelA} → {labelB}
                </h2>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
                  {dataA.length.toLocaleString()} records (base) · {dataB.length.toLocaleString()} records (compare) · {mB.fleetSize} unique vehicles
                </p>
              </div>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
                {[
                  {
                    label: "Revenue",
                    primary: cr(mB.revenue),
                    delta: pctDelta(mA.revenue, mB.revenue),
                    improved: mB.revenue >= mA.revenue,
                  },
                  {
                    label: "Net Profit",
                    primary: cr(mB.profit),
                    delta: pctDelta(mA.profit, mB.profit),
                    improved: mB.profit >= mA.profit,
                  },
                  {
                    label: "Profit Margin",
                    primary: mB.margin.toFixed(1) + "%",
                    delta: mB.margin - mA.margin,
                    improved: mB.margin >= mA.margin,
                    ppDelta: true,
                  },
                  {
                    label: "Fleet Utilisation",
                    primary: mB.activePct.toFixed(1) + "%",
                    delta: mB.activePct - mA.activePct,
                    improved: mB.activePct >= mA.activePct,
                    ppDelta: true,
                  },
                ].map(({ label, primary, delta, improved, ppDelta }) => (
                  <div
                    key={label}
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 12,
                      padding: "14px 18px",
                      minWidth: 130,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px", lineHeight: 1.1 }}>
                      {primary}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        marginTop: 5,
                        color: Math.abs(delta) < 0.1 ? "rgba(255,255,255,0.5)" : improved ? "#86efac" : "#fca5a5",
                      }}
                    >
                      {delta > 0.1 ? "▲" : delta < -0.1 ? "▼" : "—"}{" "}
                      {Math.abs(delta).toFixed(1)}{ppDelta ? "pp" : "%"}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4, fontWeight: 500 }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── KPI Comparison table ── */}
          <SectionCard title="Key Performance Indicators">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)" }}>
                    {["Metric", labelA, labelB, "Change"].map((h, i) => (
                      <th key={h} style={{ padding: "8px 14px", textAlign: i === 0 ? "left" : "right", color: i === 1 ? "#3b82f6" : i === 2 ? "#0f1c2e" : "var(--text3)", fontWeight: i === 0 ? 600 : 700, fontSize: i === 0 || i === 3 ? 11 : 12, textTransform: i === 0 || i === 3 ? "uppercase" : undefined, letterSpacing: i === 0 || i === 3 ? "0.05em" : undefined }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {([
                    { label: "Total Revenue", a: mA.revenue, b: mB.revenue, fmt: cr },
                    { label: "Total Cost", a: mA.cost, b: mB.cost, fmt: cr, invert: true },
                    { label: "Net Profit", a: mA.profit, b: mB.profit, fmt: cr },
                    { label: "Profit Margin", a: mA.margin, b: mB.margin, fmt: (v: number) => v.toFixed(1) + "%", ppDelta: true },
                    { label: "Fleet Size (vehicles)", a: mA.fleetSize, b: mB.fleetSize, fmt: (v: number) => v.toLocaleString("en-IN") },
                    { label: "Active Vehicles", a: mA.activeCount, b: mB.activeCount, fmt: (v: number) => v.toLocaleString("en-IN") },
                    { label: "Active Vehicle Rate", a: mA.activePct, b: mB.activePct, fmt: (v: number) => v.toFixed(1) + "%", ppDelta: true },
                    { label: "Avg Revenue / Active Vehicle", a: mA.avgRevPerVehicle, b: mB.avgRevPerVehicle, fmt: cr },
                    { label: "Total KMS Driven", a: mA.totalKMS, b: mB.totalKMS, fmt: (v: number) => Math.round(v).toLocaleString("en-IN") + " km" },
                    { label: "Revenue per KM", a: mA.revPerKm, b: mB.revPerKm, fmt: (v: number) => "₹" + v.toFixed(2) + "/km" },
                    { label: "Cost per KM", a: mA.costPerKm, b: mB.costPerKm, fmt: (v: number) => "₹" + v.toFixed(2) + "/km", invert: true },
                    { label: "Non-Revenue KM Ratio", a: mA.nrkRatio, b: mB.nrkRatio, fmt: (v: number) => v.toFixed(1) + "%", ppDelta: true, invert: true },
                  ] as { label: string; a: number; b: number; fmt: (v: number) => string; invert?: boolean; ppDelta?: boolean }[]).map(
                    ({ label, a, b, fmt, invert, ppDelta }, i) => {
                      const d = ppDelta ? b - a : pctDelta(a, b);
                      const isGood = invert ? d < 0 : d > 0;
                      const color = Math.abs(d) < 0.1 ? "#6b7280" : isGood ? "#16a34a" : "#dc2626";
                      return (
                        <tr key={label} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fafbfc" : "#fff" }}>
                          <td style={{ padding: "11px 14px", fontWeight: 600, color: "#374151" }}>{label}</td>
                          <td style={{ padding: "11px 14px", textAlign: "right", color: "#94a3b8" }}>{fmt(a)}</td>
                          <td style={{ padding: "11px 14px", textAlign: "right", fontWeight: 700, color: "#0f1c2e" }}>{fmt(b)}</td>
                          <td style={{ padding: "11px 14px", textAlign: "right" }}>
                            {ppDelta ? (
                              <span style={{ color, fontWeight: 700, fontSize: 12 }}>
                                {d > 0.1 ? "▲" : d < -0.1 ? "▼" : "—"} {Math.abs(d).toFixed(1)}pp
                              </span>
                            ) : (
                              <DeltaBadge val={d} invert={invert} />
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* ── Branch comparison — 2 columns ── */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid var(--border)", padding: "24px 28px", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 className="syne" style={{ fontSize: 15, fontWeight: 700, color: "#0f1c2e", margin: 0 }}>Branch Performance Comparison</h3>
              <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text3)" }}>
                <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "rgba(59,130,246,0.45)", marginRight: 5 }} />{labelA}</span>
                <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "rgba(16,185,129,0.55)", marginRight: 5 }} />{labelB}</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {branchRows.map((b) => {
                const revD = pctDelta(b.revA, b.revB);
                const marginD = b.marginB - b.marginA;
                const barA = (b.revA / maxBranchRev) * 100;
                const barB = (b.revB / maxBranchRev) * 100;
                return (
                  <div key={b.branch} style={{ background: "#fafbfc", borderRadius: 10, border: "1px solid #f1f5f9", padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#374151", textTransform: "capitalize" }}>{b.branch}</span>
                      <DeltaBadge val={revD} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10, fontSize: 11 }}>
                      <div>
                        <div style={{ color: "var(--text3)", marginBottom: 2 }}>{labelA} Rev</div>
                        <div style={{ fontWeight: 600, color: "#94a3b8" }}>{cr(b.revA)}</div>
                      </div>
                      <div>
                        <div style={{ color: "var(--text3)", marginBottom: 2 }}>{labelB} Rev</div>
                        <div style={{ fontWeight: 700, color: "#0f1c2e" }}>{cr(b.revB)}</div>
                      </div>
                      <div>
                        <div style={{ color: "var(--text3)", marginBottom: 2 }}>{labelB} Profit</div>
                        <div style={{ fontWeight: 600, color: b.profitB >= 0 ? "#16a34a" : "#dc2626" }}>{cr(b.profitB)}</div>
                      </div>
                      <div>
                        <div style={{ color: "var(--text3)", marginBottom: 2 }}>Margin</div>
                        <div style={{ fontWeight: 600, color: "#374151" }}>
                          {b.marginB.toFixed(1)}%
                          <span style={{ fontSize: 10, color: marginD >= 0 ? "#16a34a" : "#dc2626", marginLeft: 4 }}>
                            {marginD >= 0 ? "▲" : "▼"}{Math.abs(marginD).toFixed(1)}pp
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ position: "relative", height: 14, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ position: "absolute", left: 0, top: 0, height: "50%", width: barA + "%", background: "rgba(0,0,255,1)", transition: "width 0.5s ease" }} />
                      <div style={{ position: "absolute", left: 0, bottom: 0, height: "50%", width: barB + "%", background: revD >= 0 ? "rgba(0,255,0,1)" : "rgba(255,0,0,1)", transition: "width 0.5s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Vehicle model comparison ── */}
          <SectionCard title="Vehicle Model Performance">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)" }}>
                    {["Model", "Vehicles", `${labelA} Rev`, `${labelB} Rev`, "Rev Δ", `${labelB} Profit`, "Margin", "Avg Rev/Vehicle", "KMS"].map((h, i) => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: i === 0 ? "left" : "right", color: "var(--text3)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modelRows.map((m, i) => {
                    const revD = pctDelta(m.revA, m.revB);
                    const marginD = m.marginB - m.marginA;
                    return (
                      <tr key={m.model} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fafbfc" : "#fff" }}>
                        <td style={{ padding: "10px 10px", fontWeight: 700, color: "#374151" }}>
                          <div>{m.model}</div>
                          <MiniBar val={m.revB} max={maxModelRev} color="#3b82f6" />
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "right", color: "#6b7280" }}>
                          {m.countB > 0 ? m.countB : "—"}
                          {m.countA !== m.countB && (
                            <div style={{ fontSize: 10, color: m.countB > m.countA ? "#16a34a" : "#dc2626" }}>
                              {m.countB > m.countA ? "▲" : "▼"}{Math.abs(m.countB - m.countA)}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "right", color: "#94a3b8" }}>{m.revA > 0 ? cr(m.revA) : "—"}</td>
                        <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 700, color: "#0f1c2e" }}>{m.revB > 0 ? cr(m.revB) : "—"}</td>
                        <td style={{ padding: "10px 10px", textAlign: "right" }}><DeltaBadge val={revD} /></td>
                        <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 600, color: m.profitB >= 0 ? "#15803d" : "#dc2626" }}>{cr(m.profitB)}</td>
                        <td style={{ padding: "10px 10px", textAlign: "right" }}>
                          <span style={{ fontWeight: 600, color: "#374151" }}>{m.marginB.toFixed(1)}%</span>
                          <span style={{ fontSize: 10, color: marginD >= 0 ? "#16a34a" : "#dc2626", marginLeft: 4 }}>
                            {marginD >= 0 ? "▲" : "▼"}{Math.abs(marginD).toFixed(1)}pp
                          </span>
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "right", color: "#6b7280" }}>{m.avgRevB > 0 ? cr(m.avgRevB) : "—"}</td>
                        <td style={{ padding: "10px 10px", textAlign: "right", color: "#6b7280" }}>
                          {m.kmsB > 0 ? Math.round(m.kmsB).toLocaleString("en-IN") : "—"}
                          <div style={{ fontSize: 10, color: pctDelta(m.kmsA, m.kmsB) >= 0 ? "#16a34a" : "#dc2626" }}>
                            {m.kmsA > 0 && m.kmsB > 0 ? `${pctDelta(m.kmsA, m.kmsB) >= 0 ? "▲" : "▼"}${Math.abs(pctDelta(m.kmsA, m.kmsB)).toFixed(1)}%` : ""}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* ── Operational Efficiency ── */}
          <SectionCard title="Operational Efficiency">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
              {[
                { label: "Revenue / KM", a: mA.revPerKm, b: mB.revPerKm, fmt: (v: number) => "₹" + v.toFixed(2), unit: "/km", good: true },
                { label: "Cost / KM", a: mA.costPerKm, b: mB.costPerKm, fmt: (v: number) => "₹" + v.toFixed(2), unit: "/km", good: false },
                { label: "Profit / KM", a: mA.profitPerKm, b: mB.profitPerKm, fmt: (v: number) => "₹" + v.toFixed(2), unit: "/km", good: true },
                { label: "Non-Revenue KM %", a: mA.nrkRatio, b: mB.nrkRatio, fmt: (v: number) => v.toFixed(1) + "%", unit: "", good: false },
                { label: "Fuel Cost / Vehicle", a: mA.fuelPerVehicle, b: mB.fuelPerVehicle, fmt: cr, unit: "", good: false },
                { label: "Repair Cost / Vehicle", a: mA.repairPerVehicle, b: mB.repairPerVehicle, fmt: cr, unit: "", good: false },
              ].map(({ label, a, b, fmt, good }) => {
                const d = pctDelta(a, b);
                const isGood = good ? d >= 0 : d <= 0;
                const cardBg = Math.abs(d) < 1 ? "#fafbfc" : isGood ? "#f0fdf4" : "#fef2f2";
                const valColor = Math.abs(d) < 1 ? "#374151" : isGood ? "#15803d" : "#b91c1c";
                return (
                  <div key={label} style={{ background: cardBg, borderRadius: 10, border: "1px solid #e2e8f0", padding: "14px 16px" }}>
                    <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: valColor, marginBottom: 4 }}>{fmt(b)}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>was {fmt(a)}</span>
                      <DeltaBadge val={d} invert={!good} />
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* ── Cost structure + Revenue mix ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20, marginBottom: 20 }}>

            {/* Cost breakdown */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid var(--border)", padding: "24px 28px" }}>
              <h3 className="syne" style={{ fontSize: 15, fontWeight: 700, color: "#0f1c2e", marginBottom: 18 }}>Cost Structure</h3>
              {([
                { label: "Fuel", a: mA.fuelCost, b: mB.fuelCost, color: "#f59e0b" },
                { label: "Repair & Maintenance", a: mA.repairCost, b: mB.repairCost, color: "#ef4444" },
                { label: "Chauffeur", a: mA.chauffeurCost, b: mB.chauffeurCost, color: "#8b5cf6" },
                { label: "EMI / Financing", a: mA.emi, b: mB.emi, color: "#3b82f6" },
              ] as { label: string; a: number; b: number; color: string }[]).map(({ label, a, b, color }) => {
                const d = pctDelta(a, b);
                const pct = mB.cost > 0 ? (b / mB.cost) * 100 : 0;
                return (
                  <div key={label} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "center", fontSize: 12 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 2, background: color, display: "inline-block", flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: "#374151" }}>{label}</span>
                      </span>
                      <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ color: "#94a3b8" }}>{cr(a)}</span>
                        <span style={{ fontWeight: 700, color: "#0f1c2e" }}>{cr(b)}</span>
                        <DeltaBadge val={d} invert />
                      </span>
                    </div>
                    <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: pct + "%", background: color, borderRadius: 4, opacity: 0.7 }} />
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 3 }}>{pct.toFixed(1)}% of total cost in {labelB}</div>
                  </div>
                );
              })}
            </div>

            {/* Revenue mix */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid var(--border)", padding: "24px 28px" }}>
              <h3 className="syne" style={{ fontSize: 15, fontWeight: 700, color: "#0f1c2e", marginBottom: 18 }}>Revenue Mix</h3>
              {([
                { label: "Corporate Drive (CD)", a: mA.cdRevenue, b: mB.cdRevenue, color: "#3b82f6" },
                { label: "Self Drive (SD)", a: mA.sdRevenue, b: mB.sdRevenue, color: "#10b981" },
                { label: "Short Term Rental (STR)", a: mA.strRevenue, b: mB.strRevenue, color: "#f59e0b" },
              ] as { label: string; a: number; b: number; color: string }[]).map(({ label, a, b, color }) => {
                const d = pctDelta(a, b);
                const pctB = mB.revenue > 0 ? (b / mB.revenue) * 100 : 0;
                const pctA = mA.revenue > 0 ? (a / mA.revenue) * 100 : 0;
                return (
                  <div key={label} style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "center", fontSize: 12 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 2, background: color, display: "inline-block", flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: "#374151" }}>{label}</span>
                      </span>
                      <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ color: "#94a3b8" }}>{cr(a)}</span>
                        <span style={{ fontWeight: 700, color: "#0f1c2e" }}>{cr(b)}</span>
                        <DeltaBadge val={d} />
                      </span>
                    </div>
                    <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: pctB + "%", background: color, borderRadius: 4, opacity: 0.7 }} />
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 3 }}>
                      {pctB.toFixed(1)}% of revenue in {labelB}
                      {Math.abs(pctB - pctA) > 0.5 && (
                        <span style={{ color: pctB > pctA ? "#16a34a" : "#dc2626", marginLeft: 6 }}>
                          (was {pctA.toFixed(1)}% in {labelA})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Management Insights ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 24 }}>
            {[
              { icon: "✅", title: "What Worked", items: insights.wins, bg: "#f0fdf4", border: "#bbf7d0", titleColor: "#15803d", dotColor: "#16a34a", textColor: "#166534", empty: "No significant improvements detected.", ordered: false },
              { icon: "⚠️", title: "Challenges & Risks", items: insights.challenges, bg: "#fef2f2", border: "#fecaca", titleColor: "#b91c1c", dotColor: "#dc2626", textColor: "#991b1b", empty: "No major challenges identified.", ordered: false },
              { icon: "💡", title: "Recommendations", items: insights.recommendations, bg: "#eff6ff", border: "#bfdbfe", titleColor: "#1d4ed8", dotColor: "#3b82f6", textColor: "#1e40af", empty: "No specific recommendations at this time.", ordered: true },
            ].map(({ icon, title, items, bg, border, titleColor, dotColor, textColor, empty, ordered }) => (
              <div key={title} style={{ background: bg, borderRadius: 16, border: `1px solid ${border}`, padding: "22px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
                  <h3 className="syne" style={{ fontSize: 14, fontWeight: 700, color: titleColor, margin: 0 }}>{title}</h3>
                </div>
                {items.length > 0 ? (
                  ordered ? (
                    <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                      {items.map((item, i) => (
                        <li key={i} style={{ fontSize: 12, color: textColor, lineHeight: 1.55 }}>{item}</li>
                      ))}
                    </ol>
                  ) : (
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                      {items.map((item, i) => (
                        <li key={i} style={{ fontSize: 12, color: textColor, lineHeight: 1.55, paddingLeft: 14, position: "relative" }}>
                          <span style={{ position: "absolute", left: 0, top: 5, width: 6, height: 6, borderRadius: "50%", background: dotColor }} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  )
                ) : (
                  <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>{empty}</p>
                )}
              </div>
            ))}
          </div>

          {/* ── Footer ── */}
          <div style={{ textAlign: "center", padding: "14px", fontSize: 11, color: "var(--text3)", borderTop: "1px solid var(--border)" }}>
            Autoriders Fleet Intelligence · {labelA} vs {labelB} · Management Report
          </div>
        </>
      )}
    </div>
  );
}
