"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import UserMenu from "./components/UserMenu";
import FileUpload from "./components/FileUpload";
import DataManager from "./components/DataManager";
import FilterBar from "./components/FilterBar";
import KpiGrid from "./components/KpiGrid";
import InsightStrip from "./components/InsightStrip";
import Charts from "./components/Charts";
import DecisionPanel from "./components/DecisionPanel";
import VehicleTable from "./components/VehicleTable";
import VehicleTrend from "./components/VehicleTrend";
import PnLTable from "./components/PnLTable";
import ExportPDF from "./components/ExportPDF";
import type { FleetRow } from "./lib/types";
import { num, getFinancialYear, getUniqueVehicleCount } from "./lib/dataUtils";
import { getStoredUser } from "./lib/auth";

const MONTH_ORDER = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March",
];

export default function Home() {
  const router = useRouter();
  const [allData, setAllData] = useState<FleetRow[]>([]);
  const [filterBranch, setFilterBranch] = useState<string[]>([]);
  const [filterMonth, setFilterMonth] = useState<string[]>([]);
  const [filterFY, setFilterFY] = useState<string[]>([]);
  const [filterModel, setFilterModel] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showManage, setShowManage] = useState(false);

  const user = typeof window !== "undefined" ? getStoredUser() : null;

  useEffect(() => {
    if (!getStoredUser()) {
      router.push("/login");
      return;
    }
    fetchAllData();
  }, [router]);

  async function fetchAllData() {
    setLoading(true);
    try {
      const currentUser = getStoredUser();
      const role = currentUser?.role || "branch";
      const branch = currentUser?.username || "";
      const res = await fetch(`/api/data?role=${role}&branch=${encodeURIComponent(branch)}`);
      const json = await res.json();
      if (!json.files || !json.files.length) {
        setAllData([]);
        setLoading(false);
        return;
      }

      const XLSX = await import("xlsx");
      const allRows: FleetRow[] = [];

      for (const file of json.files) {
        const dlRes = await fetch(file.download_url);
        const buf = await dlRes.arrayBuffer();
        const workbook = XLSX.read(buf, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<FleetRow>(sheet, { defval: "" });
        const valid = rows.filter(r => r["Registration Number"] && String(r["Registration Number"]).trim());
        allRows.push(...valid);
      }

      setAllData(allRows);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    }
    setLoading(false);
  }

  const branches = useMemo(() => [...new Set(allData.map(r => r.Branch).filter(Boolean))].sort(), [allData]);
  const months = useMemo(() => [...new Set(allData.map(r => r.Month).filter(Boolean))].sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b)), [allData]);
  const financialYears = useMemo(() => [...new Set(allData.map(r => getFinancialYear(r.Month, r.Year)).filter(Boolean))].sort(), [allData]);
  const models = useMemo(() => [...new Set(allData.map(r => r.Model).filter(Boolean))].sort(), [allData]);

  const filteredData = useMemo(() => {
    return allData.filter(r => {
      if (filterBranch.length > 0 && !filterBranch.includes(r.Branch)) return false;
      if (filterMonth.length > 0 && !filterMonth.includes(r.Month)) return false;
      if (filterFY.length > 0 && !filterFY.includes(getFinancialYear(r.Month, r.Year))) return false;
      if (filterModel && r.Model !== filterModel) return false;
      if (filterStatus === "active" && !(num(r["Total Revenue"]) > 0)) return false;
      if (filterStatus === "idle" && num(r["Total Revenue"]) > 0) return false;
      return true;
    });
  }, [allData, filterBranch, filterMonth, filterFY, filterModel, filterStatus]);

  const handleFilterChange = (branch: string[], month: string[], fy: string[], model: string, status: string) => {
    setFilterBranch(branch);
    setFilterMonth(month);
    setFilterFY(fy);
    setFilterModel(model);
    setFilterStatus(status);
  };

  const handleDataLoaded = useCallback(async (_data: FleetRow[], file: File, filename: string) => {
    if (!user) return;
    setUploading(true);

    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((str, byte) => str + String.fromCharCode(byte), "")
    );

    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, content: base64, username: user.username }),
      });
      const json = await res.json();
      if (json.success) {
        setShowUpload(false);
        await fetchAllData();
      } else {
        alert("Upload failed: " + (json.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed. Please try again.");
    }
    setUploading(false);
  }, [user]);

  const handleReUpload = useCallback(() => {
    setShowUpload(true);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-screen" style={{ background: "var(--bg)" }}>
        <div className="spinner mb-4" />
        <p className="text-sm" style={{ color: "var(--text3)" }}>Loading fleet data...</p>
      </div>
    );
  }

  if (showUpload) {
    return (
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        <div className="flex items-center justify-between px-8 py-4">
          <button
            onClick={() => setShowUpload(false)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text2)", background: "var(--surface2)", border: "1px solid var(--border2)" }}
          >
            ← Back to Dashboard
          </button>
          <UserMenu />
        </div>
        <FileUpload onDataLoaded={handleDataLoaded} uploading={uploading} />
      </div>
    );
  }

  if (showManage) {
    return (
      <DataManager
        onClose={() => setShowManage(false)}
        onDeleted={() => fetchAllData()}
      />
    );
  }

  if (!allData.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-screen" style={{ background: "var(--bg)" }}>
        <div className="absolute top-0 right-0 p-4">
          <UserMenu />
        </div>
        <div className="text-center">
          <svg className="mx-auto mb-4" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
            <polyline points="13 2 13 9 20 9" />
          </svg>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>No data available</h2>
          <p className="text-sm mb-6" style={{ color: "var(--text3)" }}>
            {user?.role === "branch"
              ? `No files found for ${user.username}. Upload your branch data to get started.`
              : "No fleet data files found. Upload data to get started."}
          </p>
          <button
            onClick={() => setShowUpload(true)}
            className="px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--accent)" }}
          >
            Upload Data
          </button>
        </div>
      </div>
    );
  }

  const uniqueMonths = [...new Set(allData.map(r => `${r.Month} ${r.Year}`))];
  const uniqueVehicleCount = getUniqueVehicleCount(allData);

  return (
    <div className="flex flex-col flex-1 min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-8 sticky top-0 z-50"
        style={{
          height: 62,
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-3.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              boxShadow: "0 0 16px rgba(59,130,246,0.4)",
            }}
          >
            <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
              <path d="M2 15l4-8 4 3 3-6 5 11H2z" fill="white" opacity=".9" />
            </svg>
          </div>
          <div>
            <h1
              className="syne text-lg font-extrabold"
              style={{
                background: "linear-gradient(135deg, #0f1c2e, #3d5270)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                letterSpacing: "-0.3px",
              }}
            >
              Autoriders Fleet
            </h1>
            <div className="text-xs" style={{ color: "var(--text3)" }}>
              Fleet Intelligence Dashboard
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
            style={{
              color: "var(--text2)",
              background: "var(--surface2)",
              border: "1px solid var(--border)",
            }}
          >
            {uniqueVehicleCount} vehicles · {uniqueMonths.length} month{uniqueMonths.length > 1 ? "s" : ""}
          </div>
          <ExportPDF data={filteredData} />
          <button
            onClick={handleReUpload}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{
              color: "var(--accent2)",
              background: "var(--accent-glow)",
              border: "1px solid rgba(59,130,246,0.2)",
            }}
          >
            + Add New Data
          </button>
          <button
            onClick={() => setShowManage(true)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{
              color: "var(--text2)",
              background: "var(--surface2)",
              border: "1px solid var(--border2)",
            }}
          >
            Manage Data
          </button>
          <UserMenu />
        </div>
      </header>

      {/* Main */}
      <main className="max-w-screen-2xl mx-auto w-full px-8 py-6 pb-10 fade-in main-pad">
        <FilterBar
          branches={branches}
          months={months}
          financialYears={financialYears}
          models={models}
          filterBranch={filterBranch}
          filterMonth={filterMonth}
          filterFY={filterFY}
          filterModel={filterModel}
          filterStatus={filterStatus}
          totalCount={getUniqueVehicleCount(filteredData)}
          onChange={handleFilterChange}
        />
        <KpiGrid data={filteredData} />
        <InsightStrip data={filteredData} />
        <PnLTable data={filteredData} />
        <Charts data={filteredData} />
        <DecisionPanel data={filteredData} />
        <VehicleTrend data={filteredData} />
        <VehicleTable data={filteredData} />
      </main>
    </div>
  );
}
