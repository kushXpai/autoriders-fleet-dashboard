"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  branches: string[];
  months: string[];
  financialYears: string[];
  models: string[];
  filterBranch: string[];
  filterMonth: string[];
  filterFY: string[];
  filterModel: string;
  filterStatus: string;
  totalCount: number;
  onChange: (branch: string[], month: string[], fy: string[], model: string, status: string) => void;
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggle = (val: string) => {
    if (selected.includes(val)) onChange(selected.filter(v => v !== val));
    else onChange([...selected, val]);
  };

  const displayText = selected.length === 0 ? label : `${label} (${selected.length})`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="fleet-select"
        onClick={() => setOpen(o => !o)}
        style={{ minWidth: 120, textAlign: "left" }}
      >
        {displayText}
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 rounded-lg shadow-lg py-1 max-h-56 overflow-y-auto"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            minWidth: 160,
          }}
        >
          {selected.length > 0 && (
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-gray-100"
              style={{ color: "var(--accent2)" }}
              onClick={() => onChange([])}
            >
              Clear all
            </button>
          )}
          {options.map(opt => (
            <label
              key={opt}
              className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-100"
              style={{ color: "var(--text)" }}
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="rounded"
              />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FilterBar({
  branches,
  months,
  financialYears,
  models,
  filterBranch,
  filterMonth,
  filterFY,
  filterModel,
  filterStatus,
  totalCount,
  onChange,
}: Props) {
  return (
    <div
      className="rounded-2xl px-5 py-3.5 flex gap-3.5 items-center flex-wrap mb-5"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <span
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: "var(--text3)" }}
      >
        Filters
      </span>
      <div
        className="w-px h-6"
        style={{ background: "var(--border)" }}
      />

      <MultiSelect
        label="All Branches"
        options={branches}
        selected={filterBranch}
        onChange={(val) => onChange(val, filterMonth, filterFY, filterModel, filterStatus)}
      />

      <MultiSelect
        label="All Months"
        options={months}
        selected={filterMonth}
        onChange={(val) => onChange(filterBranch, val, filterFY, filterModel, filterStatus)}
      />

      <MultiSelect
        label="All FY"
        options={financialYears}
        selected={filterFY}
        onChange={(val) => onChange(filterBranch, filterMonth, val, filterModel, filterStatus)}
      />

      <select
        className="fleet-select"
        value={filterModel}
        onChange={(e) => onChange(filterBranch, filterMonth, filterFY, e.target.value, filterStatus)}
      >
        <option value="">All Models</option>
        {models.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      <select
        className="fleet-select"
        value={filterStatus}
        onChange={(e) => onChange(filterBranch, filterMonth, filterFY, filterModel, e.target.value)}
      >
        <option value="">All Vehicles</option>
        <option value="active">Revenue Generating</option>
        <option value="idle">Idle (No Revenue)</option>
      </select>

      <span
        className="ml-auto text-xs font-semibold px-3.5 py-1.5 rounded-full"
        style={{
          color: "var(--accent2)",
          background: "var(--accent-glow)",
          border: "1px solid rgba(59,130,246,0.25)",
        }}
      >
        {totalCount} vehicles
      </span>
    </div>
  );
}
