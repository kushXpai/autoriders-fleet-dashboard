// app/components/FilterBar.tsx
"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  branches: string[];
  financialYears: string[];
  months: string[];
  models: string[];
  filterBranch: string[];
  filterFY: string[];
  filterMonth: string[];
  filterModel: string;
  filterStatus: string;
  totalCount: number;
  onChange: (
    branch: string[],
    fy: string[],
    month: string[],
    model: string,
    status: string
  ) => void;
}

// "bangalore" → "Bangalore", "scb" → "Scb", "novotel" → "Novotel"
function capitalize(val: string): string {
  return val.charAt(0).toUpperCase() + val.slice(1);
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
  displayFn,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
  displayFn?: (val: string) => string;
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
    if (selected.includes(val)) onChange(selected.filter((v) => v !== val));
    else onChange([...selected, val]);
  };

  const displayText =
    selected.length === 0 ? label : `${label} (${selected.length})`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="fleet-select"
        onClick={() => setOpen((o) => !o)}
        style={{ minWidth: 130, textAlign: "left" }}
      >
        {displayText}
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 rounded-lg shadow-lg py-1 max-h-56 overflow-y-auto"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            minWidth: 170,
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
          {options.map((opt) => (
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
              {displayFn ? displayFn(opt) : opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FilterBar({
  branches,
  financialYears,
  months,
  models,
  filterBranch,
  filterFY,
  filterMonth,
  filterModel,
  filterStatus,
  totalCount,
  onChange,
}: Props) {
  return (
    <div
      className="rounded-2xl px-5 py-3.5 flex gap-3.5 items-center flex-wrap mb-5"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <span
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: "var(--text3)" }}
      >
        Filters
      </span>
      <div className="w-px h-6" style={{ background: "var(--border)" }} />

      {/* Branch — stored lowercase, displayed with first letter capitalised */}
      <MultiSelect
        label="All Branches"
        options={branches}
        selected={filterBranch}
        onChange={(val) =>
          onChange(val, filterFY, filterMonth, filterModel, filterStatus)
        }
        displayFn={capitalize}
      />

      {/* Financial Year */}
      <MultiSelect
        label="All FY"
        options={financialYears}
        selected={filterFY}
        onChange={(val) =>
          onChange(filterBranch, val, filterMonth, filterModel, filterStatus)
        }
      />

      {/* Month — stored as "Month|Year", displayed as "Apr-25" */}
      <MultiSelect
        label="All Months"
        options={months}
        selected={filterMonth}
        onChange={(val) =>
          onChange(filterBranch, filterFY, val, filterModel, filterStatus)
        }
        displayFn={(val) => {
          const [m, y] = val.split("|");
          return `${m.substring(0, 3)}-${y.slice(2)}`;
        }}
      />

      {/* Model */}
      <select
        className="fleet-select"
        value={filterModel}
        onChange={(e) =>
          onChange(
            filterBranch,
            filterFY,
            filterMonth,
            e.target.value,
            filterStatus
          )
        }
      >
        <option value="">All Models</option>
        {models.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      {/* Vehicle status */}
      <select
        className="fleet-select"
        value={filterStatus}
        onChange={(e) =>
          onChange(
            filterBranch,
            filterFY,
            filterMonth,
            filterModel,
            e.target.value
          )
        }
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