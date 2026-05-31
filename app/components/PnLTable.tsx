// app/components/PnLTable.tsx
"use client";

import type { FleetRow, MonthData } from "../lib/types";
import { num } from "../lib/dataUtils";

const MONTH_ORDER = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March",
];

function fmt(v: number): string {
  return (v / 1e5).toFixed(2);
}

function pctChange(curr: number, prev: number): string {
  if (prev === 0) return curr === 0 ? "—" : "+∞";
  const change = ((curr - prev) / Math.abs(prev)) * 100;
  const sign = change >= 0 ? "+" : "";
  return sign + change.toFixed(1) + "%";
}

function pctColor(curr: number, prev: number, invert?: boolean): string {
  if (prev === 0) return "var(--text3)";
  const change = ((curr - prev) / Math.abs(prev)) * 100;
  if (invert) return change > 0 ? "var(--red)" : change < 0 ? "var(--green)" : "var(--text3)";
  return change > 0 ? "var(--green)" : change < 0 ? "var(--red)" : "var(--text3)";
}

interface Summary {
  year: string;
  month: string;
  cdRev: number;
  sdRev: number;
  strRev: number;
  totalRev: number;
  fuel: number;
  repair: number;
  chauffeur: number;
  emi: number;
  totalCost: number;
  profit: number;
}

function groupDataByMonth(data: FleetRow[]): MonthData[] {
  const groups: Record<string, FleetRow[]> = {};
  data.forEach(row => {
    const month = row.Month || "Unknown";
    const year = row.Year || "Unknown";
    const key = `${month}|${year}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });
  return Object.entries(groups).map(([key, rows]) => {
    const [month, year] = key.split("|");
    return { month, year, data: rows };
  });
}

export default function PnLTable({ data }: { data: FleetRow[] }) {
  const allMonths = groupDataByMonth(data);

  const sorted = [...allMonths].sort((a, b) => {
    if (a.year !== b.year) return a.year.localeCompare(b.year);
    return MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month);
  });

  if (!sorted.length) return null;

  const summaries: Summary[] = sorted.map(({ year, month, data: mData }) => {
    const cdRev = mData.reduce((s, r) => s + num(r["CD Revenue"]), 0);
    const sdRev = mData.reduce((s, r) => s + num(r["SD Revenue"]), 0);
    const strRev = mData.reduce((s, r) => s + num(r["STR Revenue"]), 0);
    const totalRev = mData.reduce((s, r) => s + num(r["Total Revenue"]), 0);
    const fuel = mData.reduce((s, r) => s + num(r["Fuel Cost"]), 0);
    const repair = mData.reduce((s, r) => s + num(r["Repair Cost"]), 0);
    const chauffeur = mData.reduce((s, r) => s + num(r["Chauffeur Cost"]), 0);
    const emi = mData.reduce((s, r) => s + num(r.EMI), 0);
    const totalCost = mData.reduce((s, r) => s + num(r["Total Cost"]), 0);
    const profit = mData.reduce((s, r) => s + num(r["Profit"]), 0);
    return { year, month, cdRev, sdRev, strRev, totalRev, fuel, repair, chauffeur, emi, totalCost, profit };
  });

  const yearly = {
    cdRev: summaries.reduce((s, m) => s + m.cdRev, 0),
    sdRev: summaries.reduce((s, m) => s + m.sdRev, 0),
    strRev: summaries.reduce((s, m) => s + m.strRev, 0),
    totalRev: summaries.reduce((s, m) => s + m.totalRev, 0),
    fuel: summaries.reduce((s, m) => s + m.fuel, 0),
    repair: summaries.reduce((s, m) => s + m.repair, 0),
    chauffeur: summaries.reduce((s, m) => s + m.chauffeur, 0),
    emi: summaries.reduce((s, m) => s + m.emi, 0),
    totalCost: summaries.reduce((s, m) => s + m.totalCost, 0),
    profit: summaries.reduce((s, m) => s + m.profit, 0),
  };

  const colCount = summaries.length + 3;

  const th: React.CSSProperties = {
    padding: "10px 16px", fontSize: "11px", fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text3)",
    background: "var(--surface2)", borderBottom: "1px solid var(--border)",
    whiteSpace: "nowrap", textAlign: "right",
  };
  const td: React.CSSProperties = {
    padding: "9px 16px", fontSize: "12px", color: "var(--text2)",
    borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
    textAlign: "right", fontVariantNumeric: "tabular-nums",
  };
  const tdB: React.CSSProperties = { ...td, fontWeight: 700, color: "var(--text)" };
  const label: React.CSSProperties = {
    ...td, textAlign: "left", fontWeight: 500, color: "var(--text)",
    paddingLeft: "20px", minWidth: "200px",
  };
  const section: React.CSSProperties = {
    padding: "8px 16px", fontSize: "11px", fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--accent2)",
    background: "var(--accent-glow)", borderBottom: "1px solid var(--border)", textAlign: "left",
  };

  const Row = ({ name, values, yearlyVal, pct, isBold, bg }: {
    name: string; values: number[]; yearlyVal: number; pct: string; isBold?: boolean; bg?: string;
  }) => (
    <tr style={{ background: bg }}>
      <td style={isBold ? { ...label, fontWeight: 700 } : label}>{name}</td>
      {values.map((v, i) => <td key={i} style={isBold ? tdB : td}>{fmt(v)}</td>)}
      <td style={{ ...tdB, color: isBold ? "var(--accent2)" : "var(--text)" }}>{fmt(yearlyVal)}</td>
      <td style={{ ...td, fontWeight: 600 }}>{pct}</td>
    </tr>
  );

  return (
    <>
      <div className="rounded-2xl overflow-hidden mb-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>Monthly P&L Summary</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>All values in ₹ Lakhs</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "200px", minWidth: "200px" }} />
              {summaries.map((_, i) => <col key={i} style={{ width: "120px", minWidth: "100px" }} />)}
              <col style={{ width: "120px", minWidth: "100px" }} />
              <col style={{ width: "80px", minWidth: "70px" }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Category</th>
                {summaries.map(m => (
                  <th key={m.month + m.year} style={th}>{m.month.substring(0, 3)}-{m.year.slice(2)}</th>
                ))}
                <th style={{ ...th, color: "var(--text)" }}>YEARLY</th>
                <th style={th}>%</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={colCount} style={section}>Revenue</td></tr>
              <Row name="Chauffeur Drive Revenue" values={summaries.map(m => m.cdRev)} yearlyVal={yearly.cdRev}
                pct={yearly.totalRev > 0 ? (yearly.cdRev / yearly.totalRev * 100).toFixed(1) + "%" : "—"} />
              <Row name="Self Drive Revenue" values={summaries.map(m => m.sdRev)} yearlyVal={yearly.sdRev}
                pct={yearly.totalRev > 0 ? (yearly.sdRev / yearly.totalRev * 100).toFixed(1) + "%" : "—"} />
              <Row name="Short Term Revenue" values={summaries.map(m => m.strRev)} yearlyVal={yearly.strRev}
                pct={yearly.totalRev > 0 ? (yearly.strRev / yearly.totalRev * 100).toFixed(1) + "%" : "—"} />
              <Row name="Total Revenue" values={summaries.map(m => m.totalRev)} yearlyVal={yearly.totalRev}
                pct="100%" isBold bg="var(--surface2)" />

              <tr><td colSpan={colCount} style={section}>Expenses</td></tr>
              <Row name="Fuel" values={summaries.map(m => m.fuel)} yearlyVal={yearly.fuel}
                pct={yearly.totalCost > 0 ? (yearly.fuel / yearly.totalCost * 100).toFixed(1) + "%" : "—"} />
              <Row name="Repairs & Maintenance" values={summaries.map(m => m.repair)} yearlyVal={yearly.repair}
                pct={yearly.totalCost > 0 ? (yearly.repair / yearly.totalCost * 100).toFixed(1) + "%" : "—"} />
              <Row name="Chauffeur Cost" values={summaries.map(m => m.chauffeur)} yearlyVal={yearly.chauffeur}
                pct={yearly.totalCost > 0 ? (yearly.chauffeur / yearly.totalCost * 100).toFixed(1) + "%" : "—"} />
              <Row name="E.M.I." values={summaries.map(m => m.emi)} yearlyVal={yearly.emi}
                pct={yearly.totalCost > 0 ? (yearly.emi / yearly.totalCost * 100).toFixed(1) + "%" : "—"} />
              <Row name="Total Expenses" values={summaries.map(m => m.totalCost)} yearlyVal={yearly.totalCost}
                pct="100%" isBold bg="var(--surface2)" />

              <tr><td colSpan={colCount} style={section}>Profit</td></tr>
              <tr style={{ background: "var(--green-dim)" }}>
                <td style={{ ...label, fontWeight: 700 }}>Operating Profit</td>
                {summaries.map((m, i) => (
                  <td key={i} style={{ ...tdB, color: m.profit >= 0 ? "var(--green)" : "var(--red)" }}>{fmt(m.profit)}</td>
                ))}
                <td style={{ ...tdB, color: yearly.profit >= 0 ? "var(--green)" : "var(--red)" }}>{fmt(yearly.profit)}</td>
                <td style={{ ...td, fontWeight: 700, color: "var(--green)" }}>
                  {yearly.totalRev > 0 ? (yearly.profit / yearly.totalRev * 100).toFixed(1) + "%" : "—"}
                </td>
              </tr>
              <tr>
                <td style={label}>Profit Margin %</td>
                {summaries.map((m, i) => (
                  <td key={i} style={{ ...td, fontWeight: 600, color: m.totalRev > 0 && m.profit / m.totalRev >= 0.3 ? "var(--green)" : "var(--amber)" }}>
                    {m.totalRev > 0 ? (m.profit / m.totalRev * 100).toFixed(1) + "%" : "—"}
                  </td>
                ))}
                <td style={{ ...tdB, color: "var(--green)" }}>
                  {yearly.totalRev > 0 ? (yearly.profit / yearly.totalRev * 100).toFixed(1) + "%" : "—"}
                </td>
                <td style={td}>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {summaries.length > 1 && (
        <div className="rounded-2xl overflow-hidden mb-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>Month-on-Month % Change</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>Percentage change from previous month</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "200px", minWidth: "200px" }} />
                {summaries.slice(1).map((_, i) => <col key={i} style={{ width: "140px", minWidth: "110px" }} />)}
              </colgroup>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: "left" }}>Category</th>
                  {summaries.slice(1).map((m, i) => (
                    <th key={i} style={th}>
                      {summaries[i].month.substring(0, 3)} &rarr; {m.month.substring(0, 3)}-{m.year.slice(2)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr><td colSpan={summaries.length} style={section}>Revenue</td></tr>
                <ChangeRow label="Chauffeur Drive Revenue" summaries={summaries} field="cdRev" />
                <ChangeRow label="Self Drive Revenue" summaries={summaries} field="sdRev" />
                <ChangeRow label="Short Term Revenue" summaries={summaries} field="strRev" />
                <ChangeRow label="Total Revenue" summaries={summaries} field="totalRev" bold />

                <tr><td colSpan={summaries.length} style={section}>Expenses</td></tr>
                <ChangeRow label="Fuel" summaries={summaries} field="fuel" invert />
                <ChangeRow label="Repairs & Maintenance" summaries={summaries} field="repair" invert />
                <ChangeRow label="Chauffeur Cost" summaries={summaries} field="chauffeur" invert />
                <ChangeRow label="E.M.I." summaries={summaries} field="emi" invert />
                <ChangeRow label="Total Expenses" summaries={summaries} field="totalCost" invert bold />

                <tr><td colSpan={summaries.length} style={section}>Profit</td></tr>
                <ChangeRow label="Operating Profit" summaries={summaries} field="profit" bold />
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function ChangeRow({ label: name, summaries, field, invert, bold }: {
  label: string; summaries: Summary[]; field: keyof Summary; invert?: boolean; bold?: boolean;
}) {
  const td: React.CSSProperties = {
    padding: "9px 16px", fontSize: "12px", borderBottom: "1px solid var(--border)",
    whiteSpace: "nowrap", textAlign: "right", fontVariantNumeric: "tabular-nums",
    fontWeight: bold ? 700 : 500,
  };
  const labelSt: React.CSSProperties = {
    ...td, textAlign: "left", color: "var(--text)", paddingLeft: "20px", minWidth: "200px",
  };
  return (
    <tr>
      <td style={labelSt}>{name}</td>
      {summaries.slice(1).map((m, i) => {
        const curr = m[field] as number;
        const prev = summaries[i][field] as number;
        return (
          <td key={i} style={{ ...td, color: pctColor(curr, prev, invert) }}>
            {pctChange(curr, prev)}
          </td>
        );
      })}
    </tr>
  );
}