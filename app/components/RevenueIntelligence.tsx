// app/components/RevenueIntelligence.tsx
"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { RevenueRow } from "../lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const n = (v?: string) => parseFloat(v || "0") || 0;

function fmtCr(val: number) {
    if (val >= 1e7) return `₹${(val / 1e7).toFixed(2)} Cr`;
    if (val >= 1e5) return `₹${(val / 1e5).toFixed(1)} L`;
    return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function fmtShort(val: number) {
    if (val >= 1e7) return `₹${(val / 1e7).toFixed(2)} Cr`;
    if (val >= 1e5) return `₹${(val / 1e5).toFixed(1)} L`;
    if (val >= 1e3) return `₹${(val / 1e3).toFixed(1)}K`;
    return `₹${val.toFixed(0)}`;
}

// Parse "H:MM" or "HH:MM" duty time string → decimal hours
function parseDutyHours(s?: string): number {
    if (!s) return 0;
    const parts = s.trim().split(":");
    if (parts.length < 2) return 0;
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    return h + m / 60;
}

// Parse "DD/MM/YYYY" → Date object (returns null if invalid)
function parseDMY(s?: string): Date | null {
    if (!s) return null;
    const p = s.trim().split("/");
    if (p.length !== 3) return null;
    const d = parseInt(p[0]), m = parseInt(p[1]) - 1, y = parseInt(p[2]);
    if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
    return new Date(y, m, d);
}

// Parse "H:MM" or "HH:MM" time → hour integer 0-23
function parseHour(s?: string): number | null {
    if (!s) return null;
    const p = s.trim().split(":");
    const h = parseInt(p[0]);
    if (isNaN(h) || h < 0 || h > 23) return null;
    return h;
}

const OWNERSHIP_COLORS: Record<string, string> = {
    SELF: "#3b82f6",
    SPOT: "#f59e0b",
    ALLOTTED: "#10b981",
};

const OWNERSHIP_BG: Record<string, string> = {
    SELF: "rgba(59,130,246,0.1)",
    SPOT: "rgba(245,158,11,0.1)",
    ALLOTTED: "rgba(16,185,129,0.1)",
};

const STATUS_COLOR: Record<string, string> = {
    Success: "#10b981",
    NoAction: "#94a3b8",
    Pending: "#f59e0b",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
    label,
    value,
    sub,
    accent,
}: {
    label: string;
    value: string;
    sub?: string;
    accent?: string;
}) {
    return (
        <div
            style={{
                background: "#fff",
                border: "1px solid var(--border)",
                borderRadius: 16,
                padding: "20px 24px",
                flex: 1,
                minWidth: 0,
            }}
        >
            <div
                style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}
            >
                {label}
            </div>
            <div
                style={{ fontSize: 26, fontWeight: 800, color: accent || "var(--text)", letterSpacing: "-0.5px", lineHeight: 1.1 }}
            >
                {value}
            </div>
            {sub && (
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
                    {sub}
                </div>
            )}
        </div>
    );
}

function OwnershipBadge({ type }: { type: string }) {
    const t = (type || "").toUpperCase();
    return (
        <span
            style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 6,
                background: OWNERSHIP_BG[t] || "rgba(100,116,139,0.1)",
                color: OWNERSHIP_COLORS[t] || "#64748b",
                letterSpacing: "0.04em",
                whiteSpace: "nowrap",
            }}
        >
            {t || "—"}
        </span>
    );
}

function MiniBar({ pct, color }: { pct: number; color: string }) {
    return (
        <div style={{ height: 5, borderRadius: 99, background: "var(--border)", flex: 1, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: color, borderRadius: 99 }} />
        </div>
    );
}

// Donut chart (pure SVG)
function DonutChart({
    segments,
    size = 110,
}: {
    segments: { label: string; value: number; color: string }[];
    size?: number;
}) {
    const total = segments.reduce((s, x) => s + x.value, 0);
    if (total === 0) return null;
    const r = 38;
    const cx = size / 2;
    const cy = size / 2;
    const circ = 2 * Math.PI * r;
    let offset = 0;
    const slices = segments.map((seg) => {
        const pct = seg.value / total;
        const dash = pct * circ;
        const gap = circ - dash;
        const slice = { ...seg, dash, gap, offset };
        offset += dash;
        return slice;
    });
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {slices.map((s, i) => (
                <circle
                    key={i}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={16}
                    strokeDasharray={`${s.dash} ${s.gap}`}
                    strokeDashoffset={-s.offset + circ / 4}
                    style={{ transition: "stroke-dasharray 0.5s" }}
                />
            ))}
            <circle cx={cx} cy={cy} r={28} fill="white" />
        </svg>
    );
}

// SVG Bar Chart with axes and grid lines
function SvgBarChart({
    data,
    height = 180,
    colorFn,
}: {
    data: { label: string; value: number }[];
    height?: number;
    colorFn?: (i: number, label?: string) => string;
}) {
    const BAR_COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#14b8a6", "#f97316", "#0ea5e9", "#a855f7"];
    if (!data.length) return null;
    const max = Math.max(...data.map((d) => d.value), 1);
    const W = 500;
    const H = height;
    const padL = 50;
    const padR = 12;
    const padT = 12;
    const padB = 44;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const barW = Math.max(8, (chartW / data.length) * 0.55);
    const gap = chartW / data.length;

    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: padT + chartH * (1 - f), val: max * f }));

    return (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
            {/* Grid lines */}
            {ticks.map((t, i) => (
                <g key={i}>
                    <line x1={padL} x2={W - padR} y1={t.y} y2={t.y} stroke="#e2e8f0" strokeWidth={1} />
                    <text x={padL - 6} y={t.y + 4} fontSize={9} textAnchor="end" fill="#94a3b8">
                        {t.val >= 1e5 ? `${(t.val / 1e5).toFixed(1)}L` : t.val >= 1e3 ? `${(t.val / 1e3).toFixed(0)}K` : t.val.toFixed(0)}
                    </text>
                </g>
            ))}
            {/* X axis */}
            <line x1={padL} x2={W - padR} y1={padT + chartH} y2={padT + chartH} stroke="#cbd5e1" strokeWidth={1} />
            {/* Bars */}
            {data.map((d, i) => {
                const x = padL + gap * i + gap / 2 - barW / 2;
                const barH = (d.value / max) * chartH;
                const y = padT + chartH - barH;
                const color = colorFn ? colorFn(i, d.label) : BAR_COLORS[i % BAR_COLORS.length];
                const label = d.label.length > 8 ? d.label.slice(0, 7) + "…" : d.label;
                return (
                    <g key={i}>
                        <rect x={x} y={y} width={barW} height={barH} rx={3} fill={color} opacity={0.9} />
                        {/* Value on top */}
                        <text x={x + barW / 2} y={y - 3} fontSize={8} textAnchor="middle" fill="#64748b" fontWeight={600}>
                            {d.value >= 1e5 ? `${(d.value / 1e5).toFixed(1)}L` : d.value >= 1e3 ? `${(d.value / 1e3).toFixed(0)}K` : d.value.toFixed(0)}
                        </text>
                        {/* X label */}
                        <text
                            x={x + barW / 2}
                            y={padT + chartH + 14}
                            fontSize={8}
                            textAnchor="middle"
                            fill="#64748b"
                            transform={`rotate(-30, ${x + barW / 2}, ${padT + chartH + 14})`}
                        >
                            {label}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

// Multi-series grouped bar chart for revenue trend (SELF / SPOT / ALLOTTED + total)
function MultiBarChart({
    data,
    height = 220,
}: {
    data: { label: string; self: number; spot: number; allotted: number; total: number }[];
    height?: number;
}) {
    if (!data.length) return null;
    const maxVal = Math.max(...data.map((d) => d.total), 1);
    const W = 560;
    const H = height;
    const padL = 54;
    const padR = 14;
    const padT = 16;
    const padB = 46;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const groupW = chartW / data.length;
    const bW = Math.max(6, (groupW * 0.7) / 4);
    const gapInGroup = Math.max(1, (groupW * 0.7 - bW * 4) / 3);
    const series = [
        { key: "self" as const, color: "#3b82f6", label: "SELF" },
        { key: "spot" as const, color: "#f59e0b", label: "SPOT" },
        { key: "allotted" as const, color: "#10b981", label: "ALLOTTED" },
        { key: "total" as const, color: "#6366f1", label: "TOTAL" },
    ];
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: padT + chartH * (1 - f), val: maxVal * f }));

    return (
        <div>
            {/* Legend */}
            <div style={{ display: "flex", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                {series.map((s) => (
                    <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: "inline-block" }} />
                        <span style={{ fontSize: 10, color: "var(--text3)", fontWeight: 600 }}>{s.label}</span>
                    </div>
                ))}
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
                {ticks.map((t, i) => (
                    <g key={i}>
                        <line x1={padL} x2={W - padR} y1={t.y} y2={t.y} stroke="#e2e8f0" strokeWidth={1} />
                        <text x={padL - 6} y={t.y + 4} fontSize={9} textAnchor="end" fill="#94a3b8">
                            {t.val >= 1e5 ? `${(t.val / 1e5).toFixed(1)}L` : t.val >= 1e3 ? `${(t.val / 1e3).toFixed(0)}K` : t.val.toFixed(0)}
                        </text>
                    </g>
                ))}
                <line x1={padL} x2={W - padR} y1={padT + chartH} y2={padT + chartH} stroke="#cbd5e1" strokeWidth={1} />
                {data.map((d, gi) => {
                    const groupX = padL + groupW * gi + (groupW - bW * 4 - gapInGroup * 3) / 2;
                    return series.map((s, si) => {
                        const val = d[s.key];
                        const bH = (val / maxVal) * chartH;
                        const x = groupX + si * (bW + gapInGroup);
                        const y = padT + chartH - bH;
                        const label = d.label.length > 6 ? d.label.slice(0, 5) + "…" : d.label;
                        return (
                            <g key={`${gi}-${si}`}>
                                <rect x={x} y={y} width={bW} height={bH} rx={2} fill={s.color} opacity={0.88} />
                                {si === 3 && (
                                    <text
                                        x={groupX + (bW * 4 + gapInGroup * 3) / 2}
                                        y={padT + chartH + 14}
                                        fontSize={8}
                                        textAnchor="middle"
                                        fill="#64748b"
                                        transform={`rotate(-30, ${groupX + (bW * 4 + gapInGroup * 3) / 2}, ${padT + chartH + 14})`}
                                    >
                                        {label}
                                    </text>
                                )}
                            </g>
                        );
                    });
                })}
            </svg>
        </div>
    );
}

// Line chart (SVG)
function LineChart({
    data,
    height = 180,
    onClick,
}: {
    data: { label: string; value: number }[];
    height?: number;
    onClick?: (item: { label: string; value: number; index: number }, x: number, y: number) => void;
}) {
    if (data.length < 2) return null;
    const W = 520;
    const H = height;
    const padL = 52;
    const padR = 14;
    const padT = 16;
    const padB = 44;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const max = Math.max(...data.map((d) => d.value), 1);
    const min = Math.min(...data.map((d) => d.value), 0);
    const range = max - min || 1;

    const pts = data.map((d, i) => ({
        x: padL + (i / (data.length - 1)) * chartW,
        y: padT + chartH - ((d.value - min) / range) * chartH,
        ...d,
        index: i,
    }));

    const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const areaD = pathD + ` L ${pts[pts.length - 1].x} ${padT + chartH} L ${pts[0].x} ${padT + chartH} Z`;

    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: padT + chartH * (1 - f), val: min + range * f }));

    return (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
            <defs>
                <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.01} />
                </linearGradient>
            </defs>
            {ticks.map((t, i) => (
                <g key={i}>
                    <line x1={padL} x2={W - padR} y1={t.y} y2={t.y} stroke="#e2e8f0" strokeWidth={1} />
                    <text x={padL - 6} y={t.y + 4} fontSize={9} textAnchor="end" fill="#94a3b8">
                        {t.val >= 1e5 ? `${(t.val / 1e5).toFixed(1)}L` : t.val >= 1e3 ? `${(t.val / 1e3).toFixed(0)}K` : t.val.toFixed(0)}
                    </text>
                </g>
            ))}
            <line x1={padL} x2={W - padR} y1={padT + chartH} y2={padT + chartH} stroke="#cbd5e1" strokeWidth={1} />
            {/* Area fill */}
            <path d={areaD} fill="url(#lineAreaGrad)" />
            {/* Line */}
            <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {/* Points */}
            {pts.map((p, i) => (
                <g key={i}>
                    <circle
                        cx={p.x}
                        cy={p.y}
                        r={5}
                        fill="#fff"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        style={{ cursor: onClick ? "pointer" : "default" }}
                        onClick={(e) => {
                            if (onClick) {
                                const svgEl = (e.target as SVGCircleElement).closest("svg")!;
                                const rect = svgEl.getBoundingClientRect();
                                const scaleX = rect.width / W;
                                const scaleY = rect.height / H;
                                onClick({ label: p.label, value: p.value, index: p.index }, rect.left + p.x * scaleX, rect.top + p.y * scaleY);
                            }
                        }}
                    />
                    <text
                        x={p.x}
                        y={padT + chartH + 14}
                        fontSize={8}
                        textAnchor="middle"
                        fill="#64748b"
                        transform={`rotate(-30, ${p.x}, ${padT + chartH + 14})`}
                    >
                        {p.label.length > 7 ? p.label.slice(0, 6) + "…" : p.label}
                    </text>
                </g>
            ))}
        </svg>
    );
}

// Simple bar chart rows
function BarList({
    items,
    valueFormatter,
    colorFn,
}: {
    items: { label: string; value: number; sub?: string }[];
    valueFormatter: (v: number) => string;
    colorFn?: (i: number) => string;
}) {
    const max = Math.max(...items.map((x) => x.value), 1);
    const COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#14b8a6", "#f97316", "#0ea5e9", "#a855f7"];
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((item, i) => (
                <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: 12, color: "var(--text)", fontWeight: 500, maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.label}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {item.sub && <span style={{ fontSize: 11, color: "var(--text3)" }}>{item.sub}</span>}
                            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                                {valueFormatter(item.value)}
                            </span>
                        </div>
                    </div>
                    <MiniBar pct={(item.value / max) * 100} color={colorFn ? colorFn(i) : COLORS[i % COLORS.length]} />
                </div>
            ))}
        </div>
    );
}

// ─── Filter pill ──────────────────────────────────────────────────────────────

function FilterPill({
    label,
    options,
    value,
    onChange,
}: {
    label: string;
    options: string[];
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {label}
            </span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text)",
                    background: "#fff",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "4px 8px",
                    cursor: "pointer",
                    outline: "none",
                }}
            >
                <option value="">All</option>
                {options.map((o) => (
                    <option key={o} value={o}>{o}</option>
                ))}
            </select>
        </div>
    );
}

// ─── Date Range Picker Popup ───────────────────────────────────────────────────

function DateRangePopup({
    onClose,
    onApply,
    initial,
}: {
    onClose: () => void;
    onApply: (range: { label: string; from?: string; to?: string }) => void;
    initial?: { label: string };
}) {
    const [selected, setSelected] = useState(initial?.label || "Anytime");
    const [customFrom, setCustomFrom] = useState("");
    const [customTo, setCustomTo] = useState("");

    const presets = [
        "Anytime",
        "This Month",
        "Last Month",
        "Last 3 Months",
        "Last 6 Months",
        "This Year",
        "Last Year",
        "Custom Range",
    ];

    function getMonthKey(offset: number) {
        const d = new Date();
        d.setMonth(d.getMonth() + offset);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }

    function handleApply() {
        if (selected === "Anytime") {
            onApply({ label: "Anytime" });
        } else if (selected === "This Month") {
            const m = getMonthKey(0);
            onApply({ label: "This Month", from: m, to: m });
        } else if (selected === "Last Month") {
            const m = getMonthKey(-1);
            onApply({ label: "Last Month", from: m, to: m });
        } else if (selected === "Last 3 Months") {
            onApply({ label: "Last 3 Months", from: getMonthKey(-2), to: getMonthKey(0) });
        } else if (selected === "Last 6 Months") {
            onApply({ label: "Last 6 Months", from: getMonthKey(-5), to: getMonthKey(0) });
        } else if (selected === "This Year") {
            const y = new Date().getFullYear();
            onApply({ label: "This Year", from: `${y}-01`, to: `${y}-12` });
        } else if (selected === "Last Year") {
            const y = new Date().getFullYear() - 1;
            onApply({ label: "Last Year", from: `${y}-01`, to: `${y}-12` });
        } else if (selected === "Custom Range") {
            onApply({ label: `${customFrom} – ${customTo}`, from: customFrom, to: customTo });
        }
        onClose();
    }

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(15,23,42,0.45)",
                backdropFilter: "blur(2px)",
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: "#fff",
                    borderRadius: 20,
                    boxShadow: "0 32px 80px rgba(0,0,0,0.22)",
                    padding: "28px 32px",
                    width: "min(700px, 95vw)",
                    maxHeight: "85vh",
                    overflowY: "auto",
                    margin: "auto",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)", marginBottom: 20 }}>📅 Select Date Range</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                    {presets.map((p) => (
                        <button
                            key={p}
                            onClick={() => setSelected(p)}
                            style={{
                                padding: "10px 16px",
                                borderRadius: 10,
                                border: selected === p ? "2px solid #3b82f6" : "1px solid var(--border)",
                                background: selected === p ? "rgba(59,130,246,0.08)" : "#fff",
                                color: selected === p ? "#3b82f6" : "var(--text)",
                                fontWeight: selected === p ? 700 : 500,
                                fontSize: 13,
                                cursor: "pointer",
                                textAlign: "left",
                                transition: "all 0.15s",
                            }}
                        >
                            {p}
                        </button>
                    ))}
                </div>
                {selected === "Custom Range" && (
                    <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", marginBottom: 4 }}>FROM (YYYY-MM)</div>
                            <input
                                type="month"
                                value={customFrom}
                                onChange={(e) => setCustomFrom(e.target.value)}
                                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, outline: "none" }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", marginBottom: 4 }}>TO (YYYY-MM)</div>
                            <input
                                type="month"
                                value={customTo}
                                onChange={(e) => setCustomTo(e.target.value)}
                                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, outline: "none" }}
                            />
                        </div>
                    </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                    <button
                        onClick={onClose}
                        style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid var(--border)", background: "#fff", color: "var(--text)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleApply}
                        style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: "#3b82f6", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                    >
                        Apply
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Corporate Detail Popup ───────────────────────────────────────────────────

function CorporateDetailPopup({
    corporate,
    trips,
    onClose,
}: {
    corporate: string;
    trips: RevenueRow[];
    onClose: () => void;
}) {
    const corpTrips = trips.filter((r) => r["CORPORATE NAME"] === corporate);
    const totalRevenue = corpTrips.reduce((s, r) => s + n(r["TOTAL"]), 0);
    const totalKms = corpTrips.reduce((s, r) => s + n(r["REVENUE KMS"]), 0);
    const successTrips = corpTrips.filter((r) => r["PAYMENT STATUS"] === "Success").length;

    // Ownership breakdown
    const ownershipMap: Record<string, { trips: number; revenue: number }> = {};
    corpTrips.forEach((r) => {
        const k = (r["OWNERSHIP TYPE"] || "UNKNOWN").toUpperCase();
        if (!ownershipMap[k]) ownershipMap[k] = { trips: 0, revenue: 0 };
        ownershipMap[k].trips++;
        ownershipMap[k].revenue += n(r["TOTAL"]);
    });
    const ownershipBreakdown = Object.entries(ownershipMap).map(([k, v]) => ({
        label: k,
        ...v,
        color: OWNERSHIP_COLORS[k] || "#94a3b8",
    })).sort((a, b) => b.revenue - a.revenue);

    // Monthly trend
    const monthlyMap: Record<string, number> = {};
    corpTrips.forEach((r) => {
        const k = r["INVOICE MONTH"] || "Unknown";
        monthlyMap[k] = (monthlyMap[k] || 0) + n(r["TOTAL"]);
    });
    const monthlyData = Object.entries(monthlyMap)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => a.label.localeCompare(b.label));

    // Source branches for this corporate
    const branchMap: Record<string, number> = {};
    corpTrips.forEach((r) => {
        const k = r["SOURCE BRANCH"] || "Unknown";
        branchMap[k] = (branchMap[k] || 0) + n(r["TOTAL"]);
    });
    const branchBreakdown = Object.entries(branchMap)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(15,23,42,0.5)",
                backdropFilter: "blur(3px)",
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: "#fff",
                    borderRadius: 20,
                    boxShadow: "0 32px 80px rgba(0,0,0,0.22)",
                    padding: "28px 32px",
                    width: "min(700px, 95vw)",
                    maxHeight: "85vh",
                    overflowY: "auto",
                    margin: "auto",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                    <div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text)", marginBottom: 3 }}>{corporate}</div>
                        <div style={{ fontSize: 12, color: "var(--text3)" }}>{corpTrips.length} trips · {fmtCr(totalRevenue)} total revenue</div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ padding: "6px 14px", borderRadius: 9, border: "1px solid var(--border)", background: "#fff", color: "var(--text3)", fontWeight: 600, fontSize: 12, cursor: "pointer" }}
                    >
                        ✕ Close
                    </button>
                </div>

                {/* KPIs */}
                <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                    {[
                        { label: "Total Revenue", value: fmtCr(totalRevenue), accent: "#3b82f6" },
                        { label: "Total Trips", value: corpTrips.length.toString(), accent: "#6366f1" },
                        { label: "Success Rate", value: `${corpTrips.length ? Math.round((successTrips / corpTrips.length) * 100) : 0}%`, accent: "#10b981" },
                        { label: "Total Kms", value: `${(totalKms / 1000).toFixed(1)}K`, accent: "#f59e0b" },
                    ].map((k) => (
                        <div key={k.label} style={{ flex: "1 1 120px", background: "#f8fafc", borderRadius: 12, padding: "14px 16px" }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{k.label}</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: k.accent }}>{k.value}</div>
                        </div>
                    ))}
                </div>

                {/* Ownership breakdown */}
                <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>Fleet Ownership Split</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {ownershipBreakdown.map((o) => (
                            <div
                                key={o.label}
                                style={{
                                    flex: "1 1 120px",
                                    background: OWNERSHIP_BG[o.label] || "rgba(100,116,139,0.08)",
                                    border: `1.5px solid ${OWNERSHIP_COLORS[o.label] || "#94a3b8"}30`,
                                    borderRadius: 12,
                                    padding: "14px 16px",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: o.color, display: "inline-block" }} />
                                    <span style={{ fontSize: 11, fontWeight: 700, color: o.color }}>{o.label}</span>
                                </div>
                                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", marginBottom: 2 }}>{fmtShort(o.revenue)}</div>
                                <div style={{ fontSize: 10, color: "var(--text3)" }}>{o.trips} trips</div>
                                {o.label === "SELF" && (
                                    <div style={{ fontSize: 9, color: "#3b82f6", marginTop: 4, fontWeight: 600 }}>💰 Full profit retained</div>
                                )}
                                {o.label === "SPOT" && (
                                    <div style={{ fontSize: 9, color: "#f59e0b", marginTop: 4, fontWeight: 600 }}>⚡ Spot — margin variable</div>
                                )}
                                {o.label === "ALLOTTED" && (
                                    <div style={{ fontSize: 9, color: "#10b981", marginTop: 4, fontWeight: 600 }}>🔗 Allotted — credit shared</div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Monthly trend */}
                {monthlyData.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>Monthly Revenue</div>
                        <SvgBarChart data={monthlyData} height={140} />
                    </div>
                )}

                {/* Branch breakdown */}
                {branchBreakdown.length > 0 && (
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>Source Branches</div>
                        <BarList items={branchBreakdown} valueFormatter={fmtShort} colorFn={(i) => ["#6366f1", "#3b82f6", "#0ea5e9", "#14b8a6", "#10b981", "#84cc16"][i % 6]} />
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Tooltip popup for line chart point ───────────────────────────────────────

function LineChartTooltip({
    point,
    allData,
    anchorX,
    anchorY,
    trips,
    onClose,
}: {
    point: { label: string; value: number; index: number };
    allData: { label: string; value: number }[];
    anchorX: number;
    anchorY: number;
    trips: RevenueRow[];
    onClose: () => void;
}) {
    const monthTrips = trips.filter((r) => r["INVOICE MONTH"] === point.label);
    const prev = point.index > 0 ? allData[point.index - 1] : null;
    const delta = prev ? ((point.value - prev.value) / prev.value) * 100 : null;

    const ownershipMap: Record<string, { trips: number; revenue: number }> = {};
    monthTrips.forEach((r) => {
        const k = (r["OWNERSHIP TYPE"] || "UNKNOWN").toUpperCase();
        if (!ownershipMap[k]) ownershipMap[k] = { trips: 0, revenue: 0 };
        ownershipMap[k].trips++;
        ownershipMap[k].revenue += n(r["TOTAL"]);
    });

    // Position: center of visible viewport
    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(15,23,42,0.4)",
                backdropFilter: "blur(2px)",
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: "#fff",
                    borderRadius: 20,
                    boxShadow: "0 32px 80px rgba(0,0,0,0.22)",
                    padding: "28px 32px",
                    width: "min(700px, 95vw)",
                    maxHeight: "85vh",
                    overflowY: "auto",
                    margin: "auto",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>{point.label}</div>
                        <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{monthTrips.length} trips this month</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#3b82f6" }}>{fmtCr(point.value)}</div>
                        {delta !== null && (
                            <div style={{ fontSize: 11, fontWeight: 700, color: delta >= 0 ? "#10b981" : "#ef4444" }}>
                                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% vs prev
                            </div>
                        )}
                    </div>
                </div>

                {/* Ownership breakdown for this month */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                    {Object.entries(ownershipMap)
                        .sort((a, b) => b[1].revenue - a[1].revenue)
                        .map(([k, v]) => (
                            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 10, background: OWNERSHIP_BG[k] || "#f8fafc" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: OWNERSHIP_COLORS[k] || "#94a3b8", display: "inline-block" }} />
                                    <span style={{ fontSize: 12, fontWeight: 700, color: OWNERSHIP_COLORS[k] || "#64748b" }}>{k}</span>
                                    <span style={{ fontSize: 11, color: "var(--text3)" }}>{v.trips} trips</span>
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{fmtShort(v.revenue)}</span>
                            </div>
                        ))}
                </div>

                <div style={{ display: "flex", justifyContent: "center" }}>
                    <button
                        onClick={onClose}
                        style={{ padding: "7px 22px", borderRadius: 9, border: "1px solid var(--border)", background: "#fff", color: "var(--text3)", fontWeight: 600, fontSize: 12, cursor: "pointer" }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Ownership Profit Analysis Card ───────────────────────────────────────────

function OwnershipProfitCard({
    ownershipData,
}: {
    ownershipData: { label: string; trips: number; revenue: number; color: string }[];
}) {
    const selfData = ownershipData.find((o) => o.label === "SELF");
    const spotData = ownershipData.find((o) => o.label === "SPOT");
    const allottedData = ownershipData.find((o) => o.label === "ALLOTTED");
    const total = ownershipData.reduce((s, o) => s + o.revenue, 0);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.5 }}>
                <strong style={{ color: "var(--text)" }}>SELF</strong> vehicles = 100% profit yours. <strong style={{ color: "var(--text)" }}>ALLOTTED</strong> = tied to vendor credit, partial margin. <strong style={{ color: "var(--text)" }}>SPOT</strong> = variable margin based on rate.
            </div>
            {[
                { data: selfData, label: "SELF", desc: "Full profit retained", icon: "💰", note: "If all trips were SELF" },
                { data: spotData, label: "SPOT", desc: "Spot rate — variable profit", icon: "⚡", note: "Revenue shown, margin varies" },
                { data: allottedData, label: "ALLOTTED", desc: "Vendor credit — shared margin", icon: "🔗", note: "Credit belongs to vendor" },
            ].map(({ data, label, desc, icon, note }) => (
                data ? (
                    <div
                        key={label}
                        style={{
                            padding: "12px 14px",
                            borderRadius: 12,
                            background: OWNERSHIP_BG[label] || "#f8fafc",
                            border: `1px solid ${OWNERSHIP_COLORS[label] || "#94a3b8"}30`,
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: OWNERSHIP_COLORS[label] || "#64748b" }}>
                                {icon} {label}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>{fmtShort(data.revenue)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 10, color: "var(--text3)" }}>{data.trips} trips · {total ? ((data.revenue / total) * 100).toFixed(0) : 0}% of revenue</span>
                            <span style={{ fontSize: 10, color: "var(--text3)", fontStyle: "italic" }}>{desc}</span>
                        </div>
                        <div style={{ marginTop: 6 }}>
                            <MiniBar pct={total ? (data.revenue / total) * 100 : 0} color={OWNERSHIP_COLORS[label] || "#94a3b8"} />
                        </div>
                        {label === "SELF" && total > 0 && (
                            <div style={{ marginTop: 6, fontSize: 10, color: "#3b82f6", fontWeight: 600 }}>
                                Potential if ALLOTTED/SPOT were SELF: {fmtShort(total)} (↑{fmtShort(total - data.revenue)} more)
                            </div>
                        )}
                    </div>
                ) : null
            ))}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
    trips: RevenueRow[];
    loading: boolean;
    onUpload: (file: File) => void;
    uploading: boolean;
    /** If set, dashboard only shows data for this branch (branch login mode) */
    loggedInBranch?: string;
    /** "source" | "service" — how the branch is tied to data */
    branchMode?: "source" | "service";
}

export default function RevenueIntelligence({ trips, loading, onUpload, uploading, loggedInBranch, branchMode = "source" }: Props) {
    const [filterBranch, setFilterBranch] = useState(loggedInBranch || "");
    const [filterBranchMode, setFilterBranchMode] = useState<"source" | "service">(branchMode);
    const [filterMonth, setFilterMonth] = useState("");
    const [filterOwnership, setFilterOwnership] = useState("");
    const [filterCorporate, setFilterCorporate] = useState("");
    const [filterPayment, setFilterPayment] = useState("");
    const [sortCol, setSortCol] = useState<"revenue" | "trips" | "avg">("revenue");
    const [tableSearch, setTableSearch] = useState("");
    const [tablePage, setTablePage] = useState(0);
    const TABLE_PAGE_SIZE = 20;

    // Popup states
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [dateRange, setDateRange] = useState<{ label: string; from?: string; to?: string }>({ label: "Anytime" });
    const [selectedCorporate, setSelectedCorporate] = useState<string | null>(null);
    const [lineChartTooltip, setLineChartTooltip] = useState<{ point: { label: string; value: number; index: number }; x: number; y: number } | null>(null);

    // Lock branch filter if logged in as branch
    useEffect(() => {
        if (loggedInBranch) {
            setFilterBranch(loggedInBranch);
            setFilterBranchMode(branchMode);
        }
    }, [loggedInBranch, branchMode]);

    // ── Filter options ──────────────────────────────────────────────────────────

    const sourceBranches = useMemo(() => [...new Set(trips.map((r) => r["SOURCE BRANCH"] || "").filter(Boolean))].sort(), [trips]);
    const serviceBranches = useMemo(() => [...new Set(trips.map((r) => r["DUTY CITY"] || "").filter(Boolean))].sort(), [trips]);
    const allBranches = useMemo(() => [...new Set([...sourceBranches, ...serviceBranches])].sort(), [sourceBranches, serviceBranches]);
    const invoiceMonths = useMemo(() => [...new Set(trips.map((r) => r["INVOICE MONTH"] || "").filter(Boolean))].sort(), [trips]);
    const corporates = useMemo(() => [...new Set(trips.map((r) => r["CORPORATE NAME"] || "").filter(Boolean))].sort(), [trips]);

    // ── Filtered trips ──────────────────────────────────────────────────────────

    const filtered = useMemo(() => {
        return trips.filter((r) => {
            // Branch filter — check source OR service branch based on mode, or both if no mode
            if (filterBranch) {
                const sourceBranch = r["SOURCE BRANCH"] || "";
                const serviceBranch = r["DUTY CITY"] || "";
                if (filterBranchMode === "source" && sourceBranch !== filterBranch) return false;
                if (filterBranchMode === "service" && serviceBranch !== filterBranch) return false;
            }
            // Date range filter (by Invoice Month)
            if (dateRange.from || dateRange.to) {
                const m = r["INVOICE MONTH"] || "";
                if (dateRange.from && m < dateRange.from) return false;
                if (dateRange.to && m > dateRange.to) return false;
            }
            if (filterMonth && r["INVOICE MONTH"] !== filterMonth) return false;
            if (filterOwnership && (r["OWNERSHIP TYPE"] || "").toUpperCase() !== filterOwnership) return false;
            if (filterCorporate && r["CORPORATE NAME"] !== filterCorporate) return false;
            if (filterPayment && r["PAYMENT STATUS"] !== filterPayment) return false;
            return true;
        });
    }, [trips, filterBranch, filterBranchMode, dateRange, filterMonth, filterOwnership, filterCorporate, filterPayment]);

    // ── KPIs ────────────────────────────────────────────────────────────────────

    const kpis = useMemo(() => {
        const totalRevenue = filtered.reduce((s, r) => s + n(r["TOTAL"]), 0);
        const totalTrips = filtered.length;
        const successTrips = filtered.filter((r) => r["PAYMENT STATUS"] === "Success").length;
        const totalKms = filtered.reduce((s, r) => s + n(r["REVENUE KMS"]), 0);
        const upgraded = filtered.filter((r) => (r["UPGRADE"] || "").toUpperCase() === "YES").length;
        const avgPerTrip = totalTrips ? totalRevenue / totalTrips : 0;
        const corporateCount = new Set(filtered.map((r) => r["CORPORATE NAME"]).filter(Boolean)).size;
        return { totalRevenue, totalTrips, successTrips, totalKms, upgraded, avgPerTrip, corporateCount };
    }, [filtered]);

    // ── Ownership split ─────────────────────────────────────────────────────────

    const ownershipData = useMemo(() => {
        const map: Record<string, { trips: number; revenue: number }> = {};
        filtered.forEach((r) => {
            const k = (r["OWNERSHIP TYPE"] || "UNKNOWN").toUpperCase();
            if (!map[k]) map[k] = { trips: 0, revenue: 0 };
            map[k].trips++;
            map[k].revenue += n(r["TOTAL"]);
        });
        return Object.entries(map)
            .map(([k, v]) => ({ label: k, ...v, color: OWNERSHIP_COLORS[k] || "#94a3b8" }))
            .sort((a, b) => b.revenue - a.revenue);
    }, [filtered]);

    // ── Top corporates ──────────────────────────────────────────────────────────

    const topCorporates = useMemo(() => {
        const map: Record<string, { revenue: number; trips: number }> = {};
        filtered.forEach((r) => {
            const k = r["GROUP CODE"] || r["CORPORATE NAME"] || "Unknown";
            if (!map[k]) map[k] = { revenue: 0, trips: 0 };
            map[k].revenue += n(r["TOTAL"]);
            map[k].trips++;
        });
        return Object.entries(map)
            .map(([label, v]) => ({ label, value: v.revenue, sub: `${v.trips} trips` }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [filtered]);

    // ── Usage type breakdown ────────────────────────────────────────────────────

    const usageData = useMemo(() => {
        const map: Record<string, number> = {};
        filtered.forEach((r) => {
            const k = r["MODIFIED USAGE TYPE"] || "Unknown";
            map[k] = (map[k] || 0) + n(r["TOTAL"]);
        });
        return Object.entries(map)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
    }, [filtered]);

    // ── Car type breakdown ──────────────────────────────────────────────────────

    const carTypeData = useMemo(() => {
        const map: Record<string, { revenue: number; trips: number }> = {};
        filtered.forEach((r) => {
            const k = r["CAR SENT"] || r["CAR BOOKED"] || "Unknown";
            if (!map[k]) map[k] = { revenue: 0, trips: 0 };
            map[k].revenue += n(r["TOTAL"]);
            map[k].trips++;
        });
        return Object.entries(map)
            .map(([label, v]) => ({ label, value: v.revenue, sub: `${v.trips}` }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
    }, [filtered]);

    // ── Source branch breakdown ─────────────────────────────────────────────────

    const branchData = useMemo(() => {
        const map: Record<string, { revenue: number; trips: number }> = {};
        filtered.forEach((r) => {
            const k = r["SOURCE BRANCH"] || "Unknown";
            if (!map[k]) map[k] = { revenue: 0, trips: 0 };
            map[k].revenue += n(r["TOTAL"]);
            map[k].trips++;
        });
        return Object.entries(map)
            .map(([label, v]) => ({ label, value: v.revenue, sub: `${v.trips} trips` }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
    }, [filtered]);

    // ── Service branch breakdown ─────────────────────────────────────────────────

    const serviceBranchData = useMemo(() => {
        const map: Record<string, { revenue: number; trips: number }> = {};
        filtered.forEach((r) => {
            const k = r["DUTY CITY"] || "Unknown";
            if (!map[k]) map[k] = { revenue: 0, trips: 0 };
            map[k].revenue += n(r["TOTAL"]);
            map[k].trips++;
        });
        return Object.entries(map)
            .map(([label, v]) => ({ label, value: v.revenue, sub: `${v.trips} trips` }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
    }, [filtered]);

    // ── Monthly trend with ownership breakdown ──────────────────────────────────

    const monthlyTrend = useMemo(() => {
        const map: Record<string, { self: number; spot: number; allotted: number; total: number }> = {};
        filtered.forEach((r) => {
            const k = r["INVOICE MONTH"] || "Unknown";
            if (!map[k]) map[k] = { self: 0, spot: 0, allotted: 0, total: 0 };
            const ownership = (r["OWNERSHIP TYPE"] || "").toUpperCase();
            const val = n(r["TOTAL"]);
            map[k].total += val;
            if (ownership === "SELF") map[k].self += val;
            else if (ownership === "SPOT") map[k].spot += val;
            else if (ownership === "ALLOTTED") map[k].allotted += val;
        });
        return Object.entries(map)
            .map(([label, v]) => ({ label, ...v, value: v.total }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [filtered]);

    // ── Upgrade analysis ────────────────────────────────────────────────────────

    const upgradeData = useMemo(() => {
        const yes = filtered.filter((r) => (r["UPGRADE"] || "").toUpperCase() === "YES");
        const no = filtered.filter((r) => (r["UPGRADE"] || "").toUpperCase() !== "YES");
        return [
            { label: "Upgraded", value: yes.length, revenue: yes.reduce((s, r) => s + n(r["TOTAL"]), 0), color: "#10b981" },
            { label: "No Upgrade", value: no.length, revenue: no.reduce((s, r) => s + n(r["TOTAL"]), 0), color: "#94a3b8" },
        ];
    }, [filtered]);

    // ── [1] PEAK HOUR HEATMAP ─────────────────────────────────────────────────────
    // 24×7 grid: row = hour of day (0-23), col = day of week (0=Sun..6=Sat)
    const peakHourData = useMemo(() => {
        // grid[hour][dow] = { trips, revenue }
        const grid: { trips: number; revenue: number }[][] = Array.from({ length: 24 }, () =>
            Array.from({ length: 7 }, () => ({ trips: 0, revenue: 0 }))
        );
        let hasData = false;
        filtered.forEach((r) => {
            const hour = parseHour(r["OPENING TIME"] || r["REPORTING TIME"]);
            const date = parseDMY(r["OPENING DATE"] || r["REPORTING DATE"]);
            if (hour === null || !date) return;
            const dow = date.getDay(); // 0=Sun
            grid[hour][dow].trips++;
            grid[hour][dow].revenue += n(r["TOTAL"]);
            hasData = true;
        });
        return hasData ? grid : null;
    }, [filtered]);

    // ── [2] VEHICLE UTILISATION ────────────────────────────────────────────────────
    const vehicleUtilData = useMemo(() => {
        const map: Record<string, { trips: number; revenue: number; dutyHrs: number; revenueKms: number; dryRunKms: number }> = {};
        filtered.forEach((r) => {
            const v = r["VEHICLE NUMBER"] || "Unknown";
            if (!map[v]) map[v] = { trips: 0, revenue: 0, dutyHrs: 0, revenueKms: 0, dryRunKms: 0 };
            map[v].trips++;
            map[v].revenue += n(r["TOTAL"]);
            map[v].dutyHrs += parseDutyHours(r["ACTUAL DUTY TIME"]);
            map[v].revenueKms += n(r["REVENUE KMS"]);
            map[v].dryRunKms += n(r["DRY RUN KMS"]);
        });
        return Object.entries(map)
            .map(([vehicle, v]) => ({
                vehicle,
                ...v,
                revenuePerHr: v.dutyHrs > 0 ? v.revenue / v.dutyHrs : 0,
            }))
            .filter((v) => v.trips > 0)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 15);
    }, [filtered]);

    // ── [3] RATE REALISATION (billed vs actual per km) ─────────────────────────────
    const rateRealisationData = useMemo(() => {
        const corpMap: Record<string, { billedKmRate: number[]; actualKmRate: number[]; revenue: number; trips: number }> = {};
        filtered.forEach((r) => {
            const corp = r["CORPORATE NAME"] || "Unknown";
            const billed = n(r["RATE PER KM BILLED"]);
            const actual = n(r["RATE PER KM ACTUAL"]);
            if (billed <= 0) return;
            if (!corpMap[corp]) corpMap[corp] = { billedKmRate: [], actualKmRate: [], revenue: 0, trips: 0 };
            corpMap[corp].billedKmRate.push(billed);
            if (actual > 0) corpMap[corp].actualKmRate.push(actual);
            corpMap[corp].revenue += n(r["TOTAL"]);
            corpMap[corp].trips++;
        });
        return Object.entries(corpMap)
            .map(([corp, v]) => {
                const avgBilled = v.billedKmRate.length ? v.billedKmRate.reduce((s, x) => s + x, 0) / v.billedKmRate.length : 0;
                const avgActual = v.actualKmRate.length ? v.actualKmRate.reduce((s, x) => s + x, 0) / v.actualKmRate.length : 0;
                const realisation = avgActual > 0 ? (avgBilled / avgActual) * 100 : 100;
                return { corp, avgBilled, avgActual, realisation, revenue: v.revenue, trips: v.trips };
            })
            .filter((x) => x.avgBilled > 0)
            .sort((a, b) => b.realisation - a.realisation)
            .slice(0, 12);
    }, [filtered]);

    // ── [4] GROUP CODE ROLLUP ──────────────────────────────────────────────────────
    const groupRollupData = useMemo(() => {
        const map: Record<string, { revenue: number; trips: number; corporates: Set<string>; ownership: Record<string, number> }> = {};
        filtered.forEach((r) => {
            // Use Group Code if present, otherwise derive from Corporate Name prefix or use corporate name
            const rawGroup = r["GROUP CODE"] || "";
            // Normalise: strip digits/spaces, take first word
            const group = rawGroup.trim().toUpperCase() || "UNGROUPED";
            const corp = r["CORPORATE NAME"] || "Unknown";
            if (!map[group]) map[group] = { revenue: 0, trips: 0, corporates: new Set(), ownership: {} };
            map[group].revenue += n(r["TOTAL"]);
            map[group].trips++;
            map[group].corporates.add(corp);
            const ow = (r["OWNERSHIP TYPE"] || "OTHER").toUpperCase();
            map[group].ownership[ow] = (map[group].ownership[ow] || 0) + n(r["TOTAL"]);
        });
        return Object.entries(map)
            .map(([group, v]) => ({
                group,
                revenue: v.revenue,
                trips: v.trips,
                corporates: [...v.corporates],
                selfRevenue: v.ownership["SELF"] || 0,
                spotRevenue: v.ownership["SPOT"] || 0,
                allottedRevenue: v.ownership["ALLOTTED"] || 0,
            }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 12);
    }, [filtered]);

    // ── [5] DISPATCH-TO-INVOICE LAG ────────────────────────────────────────────────
    const invoiceLagData = useMemo(() => {
        const corpLag: Record<string, { lags: number[]; revenue: number }> = {};
        let totalLag = 0, lagCount = 0;
        filtered.forEach((r) => {
            const openDate = parseDMY(r["OPENING DATE"] || r["REPORTING DATE"]);
            const invDate = parseDMY(r["INVOICE DATE"]);
            if (!openDate || !invDate) return;
            const diffDays = Math.round((invDate.getTime() - openDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays < 0 || diffDays > 365) return; // skip outliers
            const corp = r["CORPORATE NAME"] || "Unknown";
            if (!corpLag[corp]) corpLag[corp] = { lags: [], revenue: 0 };
            corpLag[corp].lags.push(diffDays);
            corpLag[corp].revenue += n(r["TOTAL"]);
            totalLag += diffDays;
            lagCount++;
        });
        const avgOverall = lagCount > 0 ? totalLag / lagCount : 0;
        const corpList = Object.entries(corpLag)
            .map(([corp, v]) => ({
                corp,
                avgLag: v.lags.reduce((s, x) => s + x, 0) / v.lags.length,
                maxLag: Math.max(...v.lags),
                trips: v.lags.length,
                revenue: v.revenue,
            }))
            .filter((x) => x.trips >= 1)
            .sort((a, b) => b.avgLag - a.avgLag)
            .slice(0, 10);
        return { avgOverall, corpList, lagCount };
    }, [filtered]);

    // ── Outstanding invoices (NoAction) by corporate ────────────────────────────
    const outstandingData = useMemo(() => {
        const map: Record<string, { trips: number; amount: number }> = {};
        filtered.forEach(r => {
            if ((r["PAYMENT STATUS"] || "") !== "NoAction") return;
            const corp = r["CORPORATE NAME"] || "Unknown";
            if (!map[corp]) map[corp] = { trips: 0, amount: 0 };
            map[corp].trips++;
            map[corp].amount += n(r["TOTAL"]);
        });
        return Object.entries(map)
            .map(([label, v]) => ({ label, value: v.amount, sub: `${v.trips} unpaid` }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [filtered]);

    // ── Monthly success rate trend ───────────────────────────────────────────────
    const successRateTrend = useMemo(() => {
        const map: Record<string, { success: number; total: number }> = {};
        filtered.forEach(r => {
            const k = r["INVOICE MONTH"] || "Unknown";
            if (!map[k]) map[k] = { success: 0, total: 0 };
            map[k].total++;
            if (r["PAYMENT STATUS"] === "Success") map[k].success++;
        });
        return Object.entries(map)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([label, v]) => ({ label, value: v.total ? Math.round((v.success / v.total) * 100) : 0 }));
    }, [filtered]);

    // ── Credit Notes (CN) by corporate ──────────────────────────────────────────
    const creditNoteData = useMemo(() => {
        const map: Record<string, { count: number; amount: number }> = {};
        filtered.forEach(r => {
            if (!r["CN NUMBER"]) return;
            const corp = r["CORPORATE NAME"] || "Unknown";
            if (!map[corp]) map[corp] = { count: 0, amount: 0 };
            map[corp].count++;
            map[corp].amount += n(r["CN AMOUNT"]);
        });
        return Object.entries(map)
            .map(([label, v]) => ({ label, value: v.amount, sub: `${v.count} CNs` }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [filtered]);

    // ── Surcharge breakdown ──────────────────────────────────────────────────────
    const surchargeData = useMemo(() => {
        let toll = 0, parking = 0, night = 0, driver = 0, sundries = 0;
        filtered.forEach(r => {
            toll     += n(r["TOLL"]);
            parking  += n(r["PARKING AMOUNT"]);
            night    += n(r["NIGHT ALLOWANCE"]);
            driver   += n(r["DRIVER ALLOWANCE"]);
            sundries += n(r["SUNDRIES"]);
        });
        return [
            { label: "Toll", value: toll },
            { label: "Parking", value: parking },
            { label: "Night Allowance", value: night },
            { label: "Driver Allowance", value: driver },
            { label: "Sundries", value: sundries },
        ].filter(x => x.value > 0).sort((a, b) => b.value - a.value);
    }, [filtered]);

    // ── Extra KMS / HRS overrun by corporate ────────────────────────────────────
    const extraOverrunData = useMemo(() => {
        const map: Record<string, { extraKmsAmt: number; extraHrsAmt: number; trips: number }> = {};
        filtered.forEach(r => {
            const extraKmsAmt = n(r["EXTRA KMS AMOUNT"]);
            const extraHrsAmt = n(r["EXTRA HRS AMOUNT"]);
            if (extraKmsAmt + extraHrsAmt === 0) return;
            const corp = r["CORPORATE NAME"] || "Unknown";
            if (!map[corp]) map[corp] = { extraKmsAmt: 0, extraHrsAmt: 0, trips: 0 };
            map[corp].extraKmsAmt += extraKmsAmt;
            map[corp].extraHrsAmt += extraHrsAmt;
            map[corp].trips++;
        });
        return Object.entries(map)
            .map(([label, v]) => ({ label, value: v.extraKmsAmt + v.extraHrsAmt, sub: `${v.trips} trips overran` }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [filtered]);

    // ── Tax collected by month ───────────────────────────────────────────────────
    const taxByMonth = useMemo(() => {
        const map: Record<string, { cgst: number; sgst: number; igst: number }> = {};
        filtered.forEach(r => {
            const k = r["INVOICE MONTH"] || "Unknown";
            if (!map[k]) map[k] = { cgst: 0, sgst: 0, igst: 0 };
            map[k].cgst += n(r["CGST"]);
            map[k].sgst += n(r["SGST"]);
            map[k].igst += n(r["IGST"]);
        });
        return Object.entries(map)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([label, v]) => ({ label, value: v.cgst + v.sgst + v.igst }));
    }, [filtered]);

    // ── App Duty split ───────────────────────────────────────────────────────────
    const appDutyData = useMemo(() => {
        let yesTrips = 0, yesRev = 0, noTrips = 0, noRev = 0;
        filtered.forEach(r => {
            const rev = n(r["TOTAL"]);
            if ((r["APP DUTY"] || "").toUpperCase() === "YES") { yesTrips++; yesRev += rev; }
            else { noTrips++; noRev += rev; }
        });
        return [
            { label: "App Duty", value: yesRev, trips: yesTrips, color: "#3b82f6" },
            { label: "Non-App Duty", value: noRev, trips: noTrips, color: "#94a3b8" },
        ];
    }, [filtered]);

    // ── Upgrade rate by corporate ────────────────────────────────────────────────
    const upgradeRateByCorp = useMemo(() => {
        const map: Record<string, { upgraded: number; total: number }> = {};
        filtered.forEach(r => {
            const corp = r["CORPORATE NAME"] || "Unknown";
            if (!map[corp]) map[corp] = { upgraded: 0, total: 0 };
            map[corp].total++;
            if ((r["UPGRADE"] || "").toUpperCase() === "YES") map[corp].upgraded++;
        });
        return Object.entries(map)
            .filter(([, v]) => v.total >= 5)
            .map(([label, v]) => ({ label, value: Math.round((v.upgraded / v.total) * 100), sub: `${v.upgraded}/${v.total}` }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [filtered]);

    // ── Upgrade rate by car type ─────────────────────────────────────────────────
    const upgradeRateByCarType = useMemo(() => {
        const map: Record<string, { upgraded: number; total: number }> = {};
        filtered.forEach(r => {
            const car = r["CAR BOOKED"] || "Unknown";
            if (!map[car]) map[car] = { upgraded: 0, total: 0 };
            map[car].total++;
            if ((r["UPGRADE"] || "").toUpperCase() === "YES") map[car].upgraded++;
        });
        return Object.entries(map)
            .filter(([, v]) => v.total >= 3)
            .map(([label, v]) => ({ label, value: Math.round((v.upgraded / v.total) * 100), sub: `${v.upgraded}/${v.total}` }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
    }, [filtered]);

    // ── Revenue KMS vs Dry Run KMS efficiency by vehicle ────────────────────────
    const kmsEfficiencyData = useMemo(() => {
        const map: Record<string, { revKms: number; dryKms: number; trips: number }> = {};
        filtered.forEach(r => {
            const v = r["VEHICLE NUMBER"] || "Unknown";
            if (!map[v]) map[v] = { revKms: 0, dryKms: 0, trips: 0 };
            map[v].revKms += n(r["REVENUE KMS"]);
            map[v].dryKms += n(r["DRY RUN KMS"]);
            map[v].trips++;
        });
        return Object.entries(map)
            .filter(([, v]) => v.revKms + v.dryKms > 0)
            .map(([vehicle, v]) => {
                const total = v.revKms + v.dryKms;
                const effPct = total > 0 ? Math.round((v.revKms / total) * 100) : 0;
                return { vehicle, revKms: v.revKms, dryKms: v.dryKms, trips: v.trips, effPct };
            })
            .sort((a, b) => b.effPct - a.effPct)
            .slice(0, 15);
    }, [filtered]);

    // ── Vendor-wise breakdown ────────────────────────────────────────────────────
    const vendorData = useMemo(() => {
        const map: Record<string, { revenue: number; trips: number }> = {};
        filtered.forEach(r => {
            const ownership = (r["OWNERSHIP TYPE"] || "").toUpperCase();
            if (ownership === "SELF") return;
            const vendor = r["VENDOR NAME"] || "Unknown";
            if (!map[vendor]) map[vendor] = { revenue: 0, trips: 0 };
            map[vendor].revenue += n(r["TOTAL"]);
            map[vendor].trips++;
        });
        return Object.entries(map)
            .map(([label, v]) => ({ label, value: v.revenue, sub: `${v.trips} trips` }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [filtered]);

    // ── Duty duration buckets ────────────────────────────────────────────────────
    const durationBuckets = useMemo(() => {
        const buckets: Record<string, number> = { "<4h": 0, "4–6h": 0, "6–8h": 0, "8–10h": 0, "10–12h": 0, "12h+": 0 };
        filtered.forEach(r => {
            const hrs = parseDutyHours(r["ACTUAL DUTY TIME"]);
            if (hrs <= 0) return;
            if (hrs < 4) buckets["<4h"]++;
            else if (hrs < 6) buckets["4–6h"]++;
            else if (hrs < 8) buckets["6–8h"]++;
            else if (hrs < 10) buckets["8–10h"]++;
            else if (hrs < 12) buckets["10–12h"]++;
            else buckets["12h+"]++;
        });
        return Object.entries(buckets)
            .map(([label, value]) => ({ label, value }))
            .filter(x => x.value > 0);
    }, [filtered]);

    // ── Night trips (closing after 22:00) ───────────────────────────────────────
    const nightTripData = useMemo(() => {
        const byBranch: Record<string, { night: number; total: number }> = {};
        filtered.forEach(r => {
            const branch = r["SOURCE BRANCH"] || "Unknown";
            if (!byBranch[branch]) byBranch[branch] = { night: 0, total: 0 };
            byBranch[branch].total++;
            const closeHour = parseHour(r["CLOSING TIME"]);
            if (closeHour !== null && (closeHour >= 22 || closeHour < 4)) {
                byBranch[branch].night++;
            }
        });
        return Object.entries(byBranch)
            .filter(([, v]) => v.night > 0)
            .map(([label, v]) => ({ label, value: v.night, sub: `${v.total ? Math.round((v.night / v.total) * 100) : 0}% of trips` }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [filtered]);

    // ── Top drivers ──────────────────────────────────────────────────────────────
    const topDriverData = useMemo(() => {
        const map: Record<string, { trips: number; revenue: number }> = {};
        filtered.forEach(r => {
            const d = r["DRIVER NAME"] || "Unknown";
            if (!map[d]) map[d] = { trips: 0, revenue: 0 };
            map[d].trips++;
            map[d].revenue += n(r["TOTAL"]);
        });
        return Object.entries(map)
            .map(([label, v]) => ({ label, value: v.revenue, sub: `${v.trips} trips` }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [filtered]);

    // ── Corporate payment health ─────────────────────────────────────────────────
    const corpPaymentHealth = useMemo(() => {
        const map: Record<string, { success: number; total: number; totalAmt: number; outstandingAmt: number; cnAmt: number }> = {};
        filtered.forEach(r => {
            const corp = r["CORPORATE NAME"] || "Unknown";
            if (!map[corp]) map[corp] = { success: 0, total: 0, totalAmt: 0, outstandingAmt: 0, cnAmt: 0 };
            map[corp].total++;
            map[corp].totalAmt += n(r["TOTAL"]);
            if (r["PAYMENT STATUS"] === "Success") map[corp].success++;
            else map[corp].outstandingAmt += n(r["TOTAL"]);
            if (r["CN NUMBER"]) map[corp].cnAmt += n(r["CN AMOUNT"]);
        });
        return Object.entries(map)
            .filter(([, v]) => v.total >= 3)
            .map(([corp, v]) => ({
                corp,
                successRate: Math.round((v.success / v.total) * 100),
                outstanding: v.outstandingAmt,
                cnAmt: v.cnAmt,
                totalAmt: v.totalAmt,
                trips: v.total,
            }))
            .sort((a, b) => a.successRate - b.successRate)
            .slice(0, 12);
    }, [filtered]);

    // ── Corporate car type preference ────────────────────────────────────────────
    const corpCarPreference = useMemo(() => {
        const map: Record<string, Record<string, number>> = {};
        filtered.forEach(r => {
            const corp = r["CORPORATE NAME"] || "Unknown";
            const car = r["CAR SENT"] || r["CAR BOOKED"] || "Unknown";
            if (!map[corp]) map[corp] = {};
            map[corp][car] = (map[corp][car] || 0) + 1;
        });
        return Object.entries(map)
            .map(([corp, cars]) => {
                const topCar = Object.entries(cars).sort((a, b) => b[1] - a[1])[0];
                const total = Object.values(cars).reduce((s, v) => s + v, 0);
                return { corp, topCar: topCar?.[0] || "—", topCarPct: total ? Math.round(((topCar?.[1] || 0) / total) * 100) : 0, total };
            })
            .filter(x => x.total >= 5)
            .sort((a, b) => b.total - a.total)
            .slice(0, 12);
    }, [filtered]);

    // ── Trip table ──────────────────────────────────────────────────────────────

    const searchedTrips = useMemo(() => {
        if (!tableSearch) return filtered;
        const q = tableSearch.toLowerCase();
        return filtered.filter(
            (r) =>
                (r["CORPORATE NAME"] || "").toLowerCase().includes(q) ||
                (r["VEHICLE NUMBER"] || "").toLowerCase().includes(q) ||
                (r["BOOKING REFERENCE NUMBER"] || "").toLowerCase().includes(q) ||
                (r["CUSTOMER NAME"] || "").toLowerCase().includes(q) ||
                (r["DRIVER NAME"] || "").toLowerCase().includes(q)
        );
    }, [filtered, tableSearch]);

    const pagedTrips = useMemo(() => {
        return searchedTrips.slice(tablePage * TABLE_PAGE_SIZE, (tablePage + 1) * TABLE_PAGE_SIZE);
    }, [searchedTrips, tablePage]);

    const totalTablePages = Math.ceil(searchedTrips.length / TABLE_PAGE_SIZE);

    // Reset page on search/filter change
    useEffect(() => setTablePage(0), [tableSearch, filterBranch, filterMonth, filterOwnership, filterCorporate, filterPayment, dateRange]);

    // ── Empty / loading states ──────────────────────────────────────────────────

    if (loading) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
                <div style={{ fontSize: 13, color: "var(--text3)", fontWeight: 500 }}>Loading revenue data…</div>
            </div>
        );
    }

    if (trips.length === 0) {
        return (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 380,
                    background: "#fff",
                    border: "1px solid var(--border)",
                    borderRadius: 24,
                    gap: 16,
                }}
            >
                <div style={{ fontSize: 40 }}>📊</div>
                <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", textAlign: "center", marginBottom: 6 }}>
                        No Revenue Data Yet
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text3)", textAlign: "center", marginBottom: 20 }}>
                        Upload your billing/trip export (Excel/CSV) to see revenue intelligence
                    </div>
                    <label
                        style={{
                            display: "inline-block",
                            cursor: uploading ? "not-allowed" : "pointer",
                            fontSize: 13,
                            fontWeight: 700,
                            padding: "10px 24px",
                            borderRadius: 10,
                            background: "var(--accent2)",
                            color: "#fff",
                            border: "none",
                        }}
                    >
                        {uploading ? "Uploading…" : "📁 Upload Revenue File"}
                        <input
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            style={{ display: "none" }}
                            disabled={uploading}
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) onUpload(f);
                                e.target.value = "";
                            }}
                        />
                    </label>
                </div>
            </div>
        );
    }

    const card = {
        background: "#fff",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "20px 22px",
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* ── Popups ── */}
            {showDatePicker && (
                <DateRangePopup
                    onClose={() => setShowDatePicker(false)}
                    onApply={(range) => setDateRange(range)}
                    initial={dateRange}
                />
            )}
            {selectedCorporate && (
                <CorporateDetailPopup
                    corporate={selectedCorporate}
                    trips={filtered}
                    onClose={() => setSelectedCorporate(null)}
                />
            )}
            {lineChartTooltip && (
                <LineChartTooltip
                    point={lineChartTooltip.point}
                    allData={monthlyTrend}
                    anchorX={lineChartTooltip.x}
                    anchorY={lineChartTooltip.y}
                    trips={filtered}
                    onClose={() => setLineChartTooltip(null)}
                />
            )}

            {/* ── Header + Upload ── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.3px" }}>
                        💰 Revenue Intelligence
                        {loggedInBranch && (
                            <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 600, color: "#3b82f6", background: "rgba(59,130,246,0.1)", padding: "2px 10px", borderRadius: 20 }}>
                                {loggedInBranch} · {filterBranchMode === "source" ? "Source" : "Service"}
                            </span>
                        )}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
                        {filtered.length.toLocaleString()} trips · {invoiceMonths.length} months
                    </div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {/* Date range button */}
                    <button
                        onClick={() => setShowDatePicker(true)}
                        style={{
                            fontSize: 12,
                            fontWeight: 700,
                            padding: "7px 16px",
                            borderRadius: 9,
                            background: dateRange.label !== "Anytime" ? "rgba(59,130,246,0.1)" : "#fff",
                            color: dateRange.label !== "Anytime" ? "#3b82f6" : "var(--text)",
                            border: "1px solid " + (dateRange.label !== "Anytime" ? "rgba(59,130,246,0.3)" : "var(--border)"),
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                        }}
                    >
                        📅 {dateRange.label}
                    </button>
                    <label
                        style={{
                            cursor: uploading ? "not-allowed" : "pointer",
                            fontSize: 12,
                            fontWeight: 700,
                            padding: "7px 16px",
                            borderRadius: 9,
                            background: "var(--accent-glow)",
                            color: "var(--accent2)",
                            border: "1px solid rgba(59,130,246,0.2)",
                        }}
                    >
                        {uploading ? "Uploading…" : "+ Upload Revenue File"}
                        <input
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            style={{ display: "none" }}
                            disabled={uploading}
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) onUpload(f);
                                e.target.value = "";
                            }}
                        />
                    </label>
                </div>
            </div>

            {/* ── Filters ── */}
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 16,
                    alignItems: "center",
                    background: "#fff",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: "12px 18px",
                }}
            >
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    FILTERS
                </span>
                {/* Branch filter — show both source and service, locked if branch login */}
                {!loggedInBranch ? (
                    <>
                        <FilterPill label="Source Branch" options={sourceBranches} value={filterBranchMode === "source" ? filterBranch : ""} onChange={(v) => { setFilterBranchMode("source"); setFilterBranch(v); }} />
                        <FilterPill label="Duty City" options={serviceBranches} value={filterBranchMode === "service" ? filterBranch : ""} onChange={(v) => { setFilterBranchMode("service"); setFilterBranch(v); }} />
                    </>
                ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase" }}>Branch Mode</span>
                        <div style={{ display: "flex", gap: 4 }}>
                            {["source", "service"].map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setFilterBranchMode(m as "source" | "service")}
                                    style={{
                                        padding: "3px 10px",
                                        borderRadius: 6,
                                        border: "1px solid var(--border)",
                                        background: filterBranchMode === m ? "#3b82f6" : "#fff",
                                        color: filterBranchMode === m ? "#fff" : "var(--text)",
                                        fontWeight: 600,
                                        fontSize: 11,
                                        cursor: "pointer",
                                        textTransform: "capitalize",
                                    }}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <FilterPill label="Month" options={invoiceMonths} value={filterMonth} onChange={setFilterMonth} />
                <FilterPill label="Ownership" options={["SELF", "SPOT", "ALLOTTED"]} value={filterOwnership} onChange={setFilterOwnership} />
                <FilterPill label="Corporate" options={corporates} value={filterCorporate} onChange={setFilterCorporate} />
                <FilterPill label="Payment" options={["Success", "NoAction", "Pending"]} value={filterPayment} onChange={setFilterPayment} />
                {(filterBranch || filterMonth || filterOwnership || filterCorporate || filterPayment || dateRange.label !== "Anytime") && (
                    <button
                        onClick={() => {
                            if (!loggedInBranch) setFilterBranch("");
                            setFilterMonth("");
                            setFilterOwnership("");
                            setFilterCorporate("");
                            setFilterPayment("");
                            setDateRange({ label: "Anytime" });
                        }}
                        style={{ fontSize: 11, fontWeight: 600, color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "none", borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}
                    >
                        Clear All
                    </button>
                )}
            </div>

            {/* ── KPI Row ── */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <KpiCard label="Total Revenue" value={fmtCr(kpis.totalRevenue)} sub={`${kpis.totalTrips.toLocaleString()} trips`} accent="var(--accent2)" />
                <KpiCard label="Avg / Trip" value={fmtShort(kpis.avgPerTrip)} sub="per invoice" />
                <KpiCard label="Success Rate" value={`${kpis.totalTrips ? Math.round((kpis.successTrips / kpis.totalTrips) * 100) : 0}%`} sub={`${kpis.successTrips} paid`} accent="#10b981" />
                <KpiCard label="Total Kms" value={`${(kpis.totalKms / 1000).toFixed(1)}K`} sub="revenue kms" />
                <KpiCard label="Upgraded Trips" value={kpis.upgraded.toString()} sub={`${kpis.totalTrips ? Math.round((kpis.upgraded / kpis.totalTrips) * 100) : 0}% of trips`} accent="#f59e0b" />
                <KpiCard label="Corporates" value={kpis.corporateCount.toString()} sub="unique clients" />
            </div>

            {/* ── Row 2: Ownership split + Ownership profit analysis + Top corporates ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.6fr", gap: 14 }}>

                {/* Ownership split */}
                <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
                        Ownership Type Split
                        <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>by revenue</span>
                    </div>
                    <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                        <DonutChart
                            segments={ownershipData.map((o) => ({ label: o.label, value: o.revenue, color: o.color }))}
                            size={110}
                        />
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                            {ownershipData.map((o) => {
                                const total = ownershipData.reduce((s, x) => s + x.revenue, 0);
                                const pct = total ? (o.revenue / total) * 100 : 0;
                                return (
                                    <div key={o.label}>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: o.color, flexShrink: 0, display: "inline-block" }} />
                                                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{o.label}</span>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <span style={{ fontSize: 11, color: "var(--text3)" }}>{o.trips} trips</span>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{fmtShort(o.revenue)}</span>
                                                <span style={{ fontSize: 11, color: "var(--text3)", minWidth: 32, textAlign: "right" }}>{pct.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                        <MiniBar pct={pct} color={o.color} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Ownership Profit Analysis */}
                <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
                        Profit Allocation
                        <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>SELF vs SPOT vs ALLOTTED</span>
                    </div>
                    <OwnershipProfitCard ownershipData={ownershipData} />
                </div>

                {/* Top corporates — clickable */}
                <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
                        Top Corporate Clients
                        <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>click for details</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {topCorporates.map((corp, i) => {
                            const max = Math.max(...topCorporates.map((x) => x.value), 1);
                            const CORP_COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#14b8a6", "#f97316", "#0ea5e9", "#a855f7"];
                            return (
                                <div
                                    key={corp.label}
                                    style={{ cursor: "pointer" }}
                                    onClick={() => setSelectedCorporate(corp.label)}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                        <span style={{ fontSize: 12, color: "var(--text)", fontWeight: 500, maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
                                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: CORP_COLORS[i % CORP_COLORS.length], display: "inline-block", flexShrink: 0 }} />
                                            {corp.label}
                                        </span>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            {corp.sub && <span style={{ fontSize: 11, color: "var(--text3)" }}>{corp.sub}</span>}
                                            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{fmtShort(corp.value)}</span>
                                            <span style={{ fontSize: 10, color: "#3b82f6" }}>↗</span>
                                        </div>
                                    </div>
                                    <MiniBar pct={(corp.value / max) * 100} color={CORP_COLORS[i % CORP_COLORS.length]} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Row 3: Usage types + Car types ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
                        Usage Type Breakdown
                        <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>by revenue</span>
                    </div>
                    <SvgBarChart data={usageData} height={180} colorFn={(i) => ["#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#14b8a6", "#f97316"][i % 8]} />
                </div>
                <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
                        Car Type Performance
                        <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>revenue · trips</span>
                    </div>
                    <SvgBarChart data={carTypeData} height={180} colorFn={(i) => ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316", "#6366f1"][i % 8]} />
                </div>
            </div>

            {/* ── Row 4: Source branch + Service branch ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
                        Revenue by Source Branch
                    </div>
                    <SvgBarChart data={branchData} height={180} colorFn={(i) => ["#6366f1", "#3b82f6", "#0ea5e9", "#14b8a6", "#10b981", "#84cc16", "#f59e0b", "#f97316"][i % 8]} />
                </div>
                <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
                        Revenue by Duty City
                    </div>
                    <SvgBarChart data={serviceBranchData} height={180} colorFn={(i) => ["#f97316", "#f59e0b", "#10b981", "#14b8a6", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899"][i % 8]} />
                </div>
            </div>

            {/* ── Row 5: Monthly Revenue Trend (multi-bar) + Upgrades ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1.8fr 0.8fr", gap: 14 }}>

                {/* Monthly trend — multi-series bar + line overlay clickable */}
                <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        Monthly Revenue Trend
                        <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>click a point for details · invoice month</span>
                    </div>
                    {monthlyTrend.length === 0 ? (
                        <div style={{ fontSize: 12, color: "var(--text3)" }}>No month data</div>
                    ) : (
                        <>
                            {/* Multi-bar chart: SELF / SPOT / ALLOTTED / TOTAL */}
                            <MultiBarChart data={monthlyTrend} height={200} />
                            <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", marginBottom: 8 }}>Total Revenue Line (click for monthly breakdown)</div>
                                <LineChart
                                    data={monthlyTrend.map((m) => ({ label: m.label, value: m.total }))}
                                    height={150}
                                    onClick={(point, x, y) => setLineChartTooltip({ point, x, y })}
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Upgrade analysis */}
                <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>Upgrade Analysis</div>
                    <DonutChart
                        segments={upgradeData.map((u) => ({ label: u.label, value: u.value, color: u.color }))}
                        size={100}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                        {upgradeData.map((u) => (
                            <div key={u.label}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                    <span style={{ fontSize: 11, color: "var(--text)", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: u.color, display: "inline-block" }} />
                                        {u.label}
                                    </span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>{u.value}</span>
                                </div>
                                <div style={{ fontSize: 10, color: "var(--text3)", paddingLeft: 12 }}>{fmtShort(u.revenue)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Payment & Collections ── */}
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginTop: 8, marginBottom: 4 }}>💳 Payment &amp; Collections</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                        Outstanding Invoices
                        <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>NoAction by corporate</span>
                    </div>
                    {outstandingData.length === 0
                        ? <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 12 }}>No outstanding invoices</div>
                        : <BarList items={outstandingData} valueFormatter={fmtShort} colorFn={() => "#ef4444"} />
                    }
                </div>
                <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                        Payment Success Rate
                        <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>% paid · by month</span>
                    </div>
                    {successRateTrend.length < 2
                        ? <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 12 }}>Need at least 2 months</div>
                        : <LineChart data={successRateTrend} height={180} />
                    }
                </div>
                <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                        Credit Notes Issued
                        <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>CN amount by corporate</span>
                    </div>
                    {creditNoteData.length === 0
                        ? <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 12 }}>No credit notes in this period</div>
                        : <BarList items={creditNoteData} valueFormatter={fmtShort} colorFn={() => "#f59e0b"} />
                    }
                </div>
            </div>

            {/* ── Charges & Tax Breakdown ── */}
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginTop: 8, marginBottom: 4 }}>📋 Charges &amp; Tax Breakdown</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                        Surcharge Components
                        <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>Toll · Parking · Night · Driver · Sundries</span>
                    </div>
                    {surchargeData.length === 0
                        ? <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 12 }}>No surcharges in this period</div>
                        : <SvgBarChart data={surchargeData} height={180} />
                    }
                </div>
                <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                        Package Overruns by Corporate
                        <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>Extra km + hr charges</span>
                    </div>
                    {extraOverrunData.length === 0
                        ? <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 12 }}>No overruns in this period</div>
                        : <BarList items={extraOverrunData} valueFormatter={fmtShort} colorFn={() => "#8b5cf6"} />
                    }
                </div>
                <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                        Total Tax Collected
                        <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>CGST + SGST + IGST · by month</span>
                    </div>
                    {taxByMonth.length === 0
                        ? <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 12 }}>No tax data</div>
                        : <SvgBarChart data={taxByMonth} height={180} colorFn={() => "#6366f1"} />
                    }
                </div>
            </div>

            {/* ── App Duty & Upgrades ── */}
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginTop: 8, marginBottom: 4 }}>⚡ App Duty &amp; Upgrades</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
                        App Duty Split
                        <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>Revenue &amp; trips</span>
                    </div>
                    {appDutyData.map(d => {
                        const total = appDutyData.reduce((s, x) => s + x.value, 0);
                        return (
                            <div key={d.label} style={{ marginBottom: 16 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: d.color }}>{d.label}</span>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{fmtShort(d.value)}</span>
                                </div>
                                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>{d.trips} trips</div>
                                <MiniBar pct={total > 0 ? (d.value / total) * 100 : 0} color={d.color} />
                            </div>
                        );
                    })}
                </div>
                <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                        Upgrade Rate by Corporate
                        <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>% upgraded (min 5 trips)</span>
                    </div>
                    {upgradeRateByCorp.length === 0
                        ? <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 12 }}>Not enough data</div>
                        : <SvgBarChart data={upgradeRateByCorp} height={180} colorFn={() => "#10b981"} />
                    }
                </div>
                <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                        Upgrade Rate by Car Type
                        <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>% upgraded per car</span>
                    </div>
                    {upgradeRateByCarType.length === 0
                        ? <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 12 }}>Not enough data</div>
                        : <SvgBarChart data={upgradeRateByCarType} height={180} colorFn={() => "#f59e0b"} />
                    }
                </div>
            </div>

            {/* ── Vehicle & Driver Intelligence ── */}
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginTop: 8, marginBottom: 4 }}>🚗 Vehicle &amp; Driver Intelligence</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
                        Revenue vs Dry Run KMS
                        <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>Higher % = more efficient</span>
                    </div>
                    {kmsEfficiencyData.length === 0
                        ? <div style={{ fontSize: 12, color: "var(--text3)" }}>No KMS data</div>
                        : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {kmsEfficiencyData.slice(0, 10).map((v, i) => (
                                    <div key={v.vehicle} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ fontSize: 11, color: "var(--text3)", minWidth: 20 }}>{i + 1}</span>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.vehicle}</span>
                                        <span style={{ fontSize: 11, color: "var(--text3)", whiteSpace: "nowrap" }}>{v.revKms.toFixed(0)} rev / {v.dryKms.toFixed(0)} dry</span>
                                        <span style={{ fontSize: 12, fontWeight: 700, minWidth: 36, textAlign: "right", color: v.effPct >= 80 ? "#10b981" : v.effPct >= 60 ? "#f59e0b" : "#ef4444" }}>{v.effPct}%</span>
                                    </div>
                                ))}
                            </div>
                        )
                    }
                </div>
                <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
                        Vendor Revenue (SPOT + ALLOTTED)
                        <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>Excludes SELF fleet</span>
                    </div>
                    {vendorData.length === 0
                        ? <div style={{ fontSize: 12, color: "var(--text3)" }}>No vendor data</div>
                        : <BarList items={vendorData} valueFormatter={fmtShort} />
                    }
                </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                        Duty Duration Buckets
                        <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>Trips by hours</span>
                    </div>
                    {durationBuckets.length === 0
                        ? <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 12 }}>No duty time data</div>
                        : <SvgBarChart data={durationBuckets} height={180} colorFn={(i) => ["#3b82f6","#60a5fa","#93c5fd","#f59e0b","#ef4444","#8b5cf6"][i % 6]} />
                    }
                </div>
                <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                        Night Trips (after 10 PM)
                        <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>Closing after 22:00 or before 04:00</span>
                    </div>
                    {nightTripData.length === 0
                        ? <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 12 }}>No night trips</div>
                        : <BarList items={nightTripData} valueFormatter={(v) => v.toString()} colorFn={() => "#6366f1"} />
                    }
                </div>
                <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                        Top Drivers by Revenue
                        <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>Revenue contribution</span>
                    </div>
                    {topDriverData.length === 0
                        ? <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 12 }}>No driver data</div>
                        : <BarList items={topDriverData} valueFormatter={fmtShort} />
                    }
                </div>
            </div>

            {/* ── Corporate Intelligence ── */}
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginTop: 8, marginBottom: 4 }}>🏢 Corporate Intelligence</div>
            <div style={{ ...card, padding: 0, overflow: "hidden", marginBottom: 14 }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Corporate Payment Health</div>
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>Success rate · Outstanding · Credit notes (min 3 trips)</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                            <tr style={{ background: "#f8fafc" }}>
                                {["Corporate", "Trips", "Success Rate", "Outstanding", "CN Amount"].map(h => (
                                    <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {corpPaymentHealth.length === 0 ? (
                                <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>No data</td></tr>
                            ) : corpPaymentHealth.map((row, i) => (
                                <tr key={row.corp} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                                    <td style={{ padding: "8px 14px", fontWeight: 600, color: "var(--text)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.corp}</td>
                                    <td style={{ padding: "8px 14px", color: "var(--text3)" }}>{row.trips}</td>
                                    <td style={{ padding: "8px 14px" }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: row.successRate >= 80 ? "rgba(16,185,129,0.1)" : row.successRate >= 60 ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)", color: row.successRate >= 80 ? "#10b981" : row.successRate >= 60 ? "#f59e0b" : "#ef4444" }}>
                                            {row.successRate}%
                                        </span>
                                    </td>
                                    <td style={{ padding: "8px 14px", fontWeight: 600, color: row.outstanding > 0 ? "#ef4444" : "var(--text3)" }}>{row.outstanding > 0 ? fmtShort(row.outstanding) : "—"}</td>
                                    <td style={{ padding: "8px 14px", fontWeight: 600, color: row.cnAmt > 0 ? "#f59e0b" : "var(--text3)" }}>{row.cnAmt > 0 ? fmtShort(row.cnAmt) : "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <div style={card}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
                    Corporate Car Preferences
                    <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>Most-booked car type per corporate (min 5 trips)</span>
                </div>
                {corpCarPreference.length === 0
                    ? <div style={{ fontSize: 12, color: "var(--text3)" }}>Not enough data</div>
                    : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                            {corpCarPreference.map((c, i) => {
                                const PREF_COLORS = ["#3b82f6","#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#14b8a6","#f97316","#0ea5e9","#a855f7","#84cc16","#ef4444"];
                                return (
                                    <div key={c.corp} style={{ background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.corp}>{c.corp}</div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: PREF_COLORS[i % PREF_COLORS.length], marginBottom: 2 }}>{c.topCar}</div>
                                        <div style={{ fontSize: 10, color: "var(--text3)" }}>{c.topCarPct}% · {c.total} trips</div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                }
            </div>

            {/* ── Trip Detail Table ── */}
            <div style={{ ...card, padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Trip Detail</div>
                        <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{searchedTrips.length.toLocaleString()} trips</div>
                    </div>
                    <input
                        value={tableSearch}
                        onChange={(e) => setTableSearch(e.target.value)}
                        placeholder="Search corporate, vehicle, booking ref…"
                        style={{
                            fontSize: 12,
                            padding: "7px 12px",
                            border: "1px solid var(--border)",
                            borderRadius: 9,
                            outline: "none",
                            width: 260,
                            color: "var(--text)",
                            background: "#fff",
                        }}
                    />
                </div>

                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                            <tr style={{ background: "#f8fafc" }}>
                                {["Booking Ref", "Invoice Month", "Corporate", "Source Branch", "Duty City", "Car Sent", "Ownership", "Usage Type", "Upgrade", "Kms", "Total", "Payment"].map((h) => (
                                    <th
                                        key={h}
                                        style={{
                                            padding: "9px 12px",
                                            textAlign: "left",
                                            fontSize: 10,
                                            fontWeight: 700,
                                            color: "var(--text3)",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.05em",
                                            borderBottom: "1px solid var(--border)",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {pagedTrips.map((r, i) => {
                                const payStatus = r["PAYMENT STATUS"] || "";
                                return (
                                    <tr
                                        key={i}
                                        style={{
                                            borderBottom: "1px solid var(--border)",
                                            background: i % 2 === 0 ? "#fff" : "#fafbfc",
                                        }}
                                    >
                                        <td style={{ padding: "8px 12px", color: "var(--text)", fontWeight: 600, whiteSpace: "nowrap" }}>
                                            {r["BOOKING REFERENCE NUMBER"] || "—"}
                                        </td>
                                        <td style={{ padding: "8px 12px", color: "var(--text3)", whiteSpace: "nowrap" }}>
                                            {r["INVOICE MONTH"] || "—"}
                                        </td>
                                        <td style={{ padding: "8px 12px", color: "var(--text)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {r["CORPORATE NAME"] || "—"}
                                        </td>
                                        <td style={{ padding: "8px 12px", color: "var(--text3)", whiteSpace: "nowrap" }}>
                                            {r["SOURCE BRANCH"] || "—"}
                                        </td>
                                        <td style={{ padding: "8px 12px", color: "var(--text3)", whiteSpace: "nowrap" }}>
                                            {r["DUTY CITY"] || "—"}
                                        </td>
                                        <td style={{ padding: "8px 12px", color: "var(--text)", whiteSpace: "nowrap" }}>
                                            {r["CAR SENT"] || r["CAR BOOKED"] || "—"}
                                        </td>
                                        <td style={{ padding: "8px 12px" }}>
                                            <OwnershipBadge type={r["OWNERSHIP TYPE"] || ""} />
                                        </td>
                                        <td style={{ padding: "8px 12px", color: "var(--text3)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {r["MODIFIED USAGE TYPE"] || "—"}
                                        </td>
                                        <td style={{ padding: "8px 12px", textAlign: "center" }}>
                                            {(r["UPGRADE"] || "").toUpperCase() === "YES" ? (
                                                <span style={{ fontSize: 10, fontWeight: 700, color: "#10b981", background: "rgba(16,185,129,0.1)", padding: "2px 6px", borderRadius: 5 }}>YES</span>
                                            ) : (
                                                <span style={{ fontSize: 10, color: "var(--text3)" }}>—</span>
                                            )}
                                        </td>
                                        <td style={{ padding: "8px 12px", color: "var(--text3)", textAlign: "right" }}>
                                            {n(r["REVENUE KMS"]).toFixed(0)}
                                        </td>
                                        <td style={{ padding: "8px 12px", fontWeight: 700, color: "var(--text)", textAlign: "right", whiteSpace: "nowrap" }}>
                                            {fmtShort(n(r["TOTAL"]))}
                                        </td>
                                        <td style={{ padding: "8px 12px" }}>
                                            <span
                                                style={{
                                                    fontSize: 10,
                                                    fontWeight: 700,
                                                    padding: "2px 7px",
                                                    borderRadius: 6,
                                                    background: payStatus === "Success" ? "rgba(16,185,129,0.1)" : "rgba(148,163,184,0.12)",
                                                    color: STATUS_COLOR[payStatus] || "#94a3b8",
                                                }}
                                            >
                                                {payStatus || "—"}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {pagedTrips.length === 0 && (
                                <tr>
                                    <td colSpan={12} style={{ padding: 32, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>
                                        No trips match your filters
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalTablePages > 1 && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", borderTop: "1px solid var(--border)", background: "#fafbfc" }}>
                        <span style={{ fontSize: 11, color: "var(--text3)" }}>
                            Page {tablePage + 1} of {totalTablePages} · {searchedTrips.length} trips
                        </span>
                        <div style={{ display: "flex", gap: 6 }}>
                            <button
                                onClick={() => setTablePage((p) => Math.max(0, p - 1))}
                                disabled={tablePage === 0}
                                style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "#fff", cursor: tablePage === 0 ? "not-allowed" : "pointer", color: tablePage === 0 ? "var(--text3)" : "var(--text)" }}
                            >
                                ← Prev
                            </button>
                            <button
                                onClick={() => setTablePage((p) => Math.min(totalTablePages - 1, p + 1))}
                                disabled={tablePage >= totalTablePages - 1}
                                style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "#fff", cursor: tablePage >= totalTablePages - 1 ? "not-allowed" : "pointer", color: tablePage >= totalTablePages - 1 ? "var(--text3)" : "var(--text)" }}
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}