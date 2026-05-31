// app/components/ExportPDF.tsx
"use client";

import { useState } from "react";
import type { FleetRow } from "../lib/types";
import { num, cr, getUniqueVehicleCount, aggregateByVehicle } from "../lib/dataUtils";

interface Props {
  data: FleetRow[];
}

export default function ExportPDF({ data }: Props) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const uniqueVehicles = getUniqueVehicleCount(data);
      const uniqueMonths = [...new Set(data.map(r => `${r.Month} ${r.Year}`))];
      const agg = aggregateByVehicle(data);

      const totalRevenue = data.reduce((s, r) => s + num(r["Total Revenue"]), 0);
      const totalCost = data.reduce((s, r) => s + num(r["Total Cost"]), 0);
      const totalProfit = data.reduce((s, r) => s + num(r.Profit), 0);
      const margin = totalRevenue > 0 ? (totalProfit / totalRevenue * 100).toFixed(1) : "0";
      const fuel = data.reduce((s, r) => s + num(r["Fuel Cost"]), 0);
      const repair = data.reduce((s, r) => s + num(r["Repair Cost"]), 0);
      const chauffeur = data.reduce((s, r) => s + num(r["Chauffeur Cost"]), 0);
      const emi = data.reduce((s, r) => s + num(r["EMI"]), 0);

      const activeRegs = new Set<string>();
      data.forEach(r => { if (num(r["Total Revenue"]) > 0) activeRegs.add(r["Registration Number"]); });

      // Page 1: Summary
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Autoriders Fleet - Performance Report", 14, 16);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`, pageWidth - 14, 16, { align: "right" });
      doc.text(`${uniqueVehicles} vehicles | ${uniqueMonths.length} month(s)`, pageWidth - 14, 22, { align: "right" });

      let y = 38;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Key Performance Indicators", 14, y);
      y += 10;

      const kpis = [
        ["Total Revenue", cr(totalRevenue)],
        ["Total Expenses", cr(totalCost)],
        ["Net Profit", cr(totalProfit)],
        ["Profit Margin", margin + "%"],
        ["Fleet Size", `${uniqueVehicles} vehicles`],
        ["Active Vehicles", `${activeRegs.size}`],
        ["Idle Vehicles", `${uniqueVehicles - activeRegs.size}`],
        ["Months Covered", uniqueMonths.join(", ")],
      ];

      doc.setFontSize(10);
      const colW = (pageWidth - 28) / 4;
      kpis.forEach(([label, value], i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = 14 + col * colW;
        const ky = y + row * 18;

        doc.setFillColor(241, 245, 249);
        doc.roundedRect(x, ky - 4, colW - 4, 14, 2, 2, "F");
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(8);
        doc.text(label, x + 4, ky + 1);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(11);
        doc.text(value, x + 4, ky + 8);
      });

      y += 46;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Cost Breakdown", 14, y);
      y += 8;

      const costs = [
        ["Fuel", fuel],
        ["Chauffeur", chauffeur],
        ["EMI", emi],
        ["Repairs", repair],
      ];
      const totalCostSum = fuel + chauffeur + emi + repair;

      doc.setFontSize(9);
      costs.forEach(([label, val], i) => {
        const pct = totalCostSum > 0 ? ((val as number) / totalCostSum * 100).toFixed(1) : "0";
        const x = 14;
        const cy = y + i * 10;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(`${label}`, x, cy);
        doc.text(cr(val as number), x + 50, cy);
        doc.text(`${pct}%`, x + 90, cy);

        doc.setFillColor(226, 232, 240);
        doc.roundedRect(x + 110, cy - 3, 100, 4, 1, 1, "F");
        const barW = totalCostSum > 0 ? ((val as number) / totalCostSum) * 100 : 0;
        doc.setFillColor(37, 99, 235);
        doc.roundedRect(x + 110, cy - 3, barW, 4, 1, 1, "F");
      });

      // Page 2: Top vehicles
      doc.addPage();
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 20, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Top Performing Vehicles", 14, 13);

      y = 30;
      const headers = ["Reg. Number", "Model", "Branch", "Revenue", "Cost", "Profit", "Margin"];
      const colWidths = [45, 35, 35, 35, 35, 35, 25];
      let x = 14;

      doc.setFillColor(241, 245, 249);
      doc.rect(14, y - 4, pageWidth - 28, 8, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 116, 139);
      headers.forEach((h, i) => {
        doc.text(h, x, y);
        x += colWidths[i];
      });

      y += 8;
      const topVehicles = [...agg]
        .filter(r => num(r["Total Revenue"]) > 0)
        .sort((a, b) => num(b.Profit) - num(a.Profit))
        .slice(0, 25);

      doc.setFontSize(8);
      topVehicles.forEach((r, idx) => {
        if (y > pageHeight - 15) {
          doc.addPage();
          y = 20;
        }

        const rev = num(r["Total Revenue"]);
        const cost = num(r["Total Cost"]);
        const prof = num(r.Profit);
        const marg = rev > 0 ? (prof / rev * 100).toFixed(1) + "%" : "—";

        if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(14, y - 4, pageWidth - 28, 8, "F");
        }

        x = 14;
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(r["Registration Number"] || "—", x, y); x += colWidths[0];
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(r.Model || "—", x, y); x += colWidths[1];
        doc.text(r.Branch || "—", x, y); x += colWidths[2];
        doc.text(`₹${(rev / 1e3).toFixed(0)}K`, x, y); x += colWidths[3];
        doc.text(`₹${(cost / 1e3).toFixed(0)}K`, x, y); x += colWidths[4];
        doc.setTextColor(prof >= 0 ? 5 : 220, prof >= 0 ? 150 : 38, prof >= 0 ? 105 : 38);
        doc.text(`₹${(prof / 1e3).toFixed(0)}K`, x, y); x += colWidths[5];
        doc.text(marg, x, y);

        y += 8;
      });

      // Page 3: Loss-making vehicles
      doc.addPage();
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 20, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Loss-Making Vehicles", 14, 13);

      y = 30;
      x = 14;
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y - 4, pageWidth - 28, 8, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 116, 139);
      headers.forEach((h, i) => {
        doc.text(h, x, y);
        x += colWidths[i];
      });

      y += 8;
      const lossVehicles = [...agg]
        .filter(r => num(r.Profit) < 0)
        .sort((a, b) => num(a.Profit) - num(b.Profit))
        .slice(0, 25);

      if (lossVehicles.length === 0) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(10);
        doc.text("No loss-making vehicles found.", 14, y + 5);
      } else {
        doc.setFontSize(8);
        lossVehicles.forEach((r, idx) => {
          if (y > pageHeight - 15) {
            doc.addPage();
            y = 20;
          }

          const rev = num(r["Total Revenue"]);
          const cost = num(r["Total Cost"]);
          const prof = num(r.Profit);
          const marg = rev > 0 ? (prof / rev * 100).toFixed(1) + "%" : "—";

          if (idx % 2 === 0) {
            doc.setFillColor(248, 250, 252);
            doc.rect(14, y - 4, pageWidth - 28, 8, "F");
          }

          x = 14;
          doc.setFont("helvetica", "bold");
          doc.setTextColor(15, 23, 42);
          doc.text(r["Registration Number"] || "—", x, y); x += colWidths[0];
          doc.setFont("helvetica", "normal");
          doc.setTextColor(71, 85, 105);
          doc.text(r.Model || "—", x, y); x += colWidths[1];
          doc.text(r.Branch || "—", x, y); x += colWidths[2];
          doc.text(`₹${(rev / 1e3).toFixed(0)}K`, x, y); x += colWidths[3];
          doc.text(`₹${(cost / 1e3).toFixed(0)}K`, x, y); x += colWidths[4];
          doc.setTextColor(220, 38, 38);
          doc.text(`₹${(prof / 1e3).toFixed(0)}K`, x, y); x += colWidths[5];
          doc.text(marg, x, y);

          y += 8;
        });
      }

      // Footer on all pages
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Autoriders Fleet Dashboard | Page ${i} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 6,
          { align: "center" }
        );
      }

      doc.save("autoriders-fleet-report.pdf");
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("PDF export failed. Please try again.");
    }
    setExporting(false);
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting || data.length === 0}
      className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
      style={{
        color: "var(--accent2)",
        background: "var(--accent-glow)",
        border: "1px solid rgba(37,99,235,0.2)",
      }}
    >
      {exporting ? "Generating..." : "↓ PDF Report"}
    </button>
  );
}
