"use client";

// app/components/FileUpload.tsx

import { useCallback, useState } from "react";
import { getStoredUser } from "../lib/auth";
import type { FleetRow } from "../lib/types";

interface Props {
  onDataLoaded: (data: FleetRow[]) => void;
}

export default function FileUpload({ onDataLoaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [dragging, setDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [duplicateLabels, setDuplicateLabels] = useState<string[]>([]);

  const upload = useCallback(
    async (files: File[], overwrite = false) => {
      if (!files.length) return;

      setUploading(true);
      setError(null);
      setProgress(`Uploading ${files.length} file${files.length > 1 ? "s" : ""}…`);

      try {
        const formData = new FormData();
        files.forEach((f) => formData.append("files", f));
        if (overwrite) formData.append("overwrite", "true");

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const uploadResult = await uploadRes.json();

        if (!uploadRes.ok) {
          throw new Error(uploadResult.error || "Upload failed");
        }

        if (uploadResult.duplicates?.length && !overwrite) {
          setDuplicateLabels(uploadResult.duplicates);
          setPendingFiles(files);
          setUploading(false);
          setProgress("");
          return;
        }

        if (uploadResult.errors?.length) {
          console.warn("Upload warnings:", uploadResult.errors);
        }

        setProgress(`Saved ${uploadResult.inserted} rows. Loading dashboard…`);

        const user = getStoredUser();
        const role = user?.role || "branch";
        const branch = user?.username || "";
        const dataRes = await fetch(`/api/data?role=${role}&branch=${encodeURIComponent(branch)}`);
        const dataResult = await dataRes.json();

        if (!dataRes.ok) {
          throw new Error(dataResult.error || "Failed to load data");
        }

        setPendingFiles(null);
        setDuplicateLabels([]);
        onDataLoaded(dataResult.data as FleetRow[]);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setUploading(false);
        setProgress("");
      }
    },
    [onDataLoaded]
  );

  const handleFiles = useCallback(
    (files: File[]) => {
      setPendingFiles(null);
      setDuplicateLabels([]);
      upload(files, false);
    },
    [upload]
  );

  const handleOverwrite = () => {
    if (pendingFiles) upload(pendingFiles, true);
  };

  const handleCancelOverwrite = () => {
    setPendingFiles(null);
    setDuplicateLabels([]);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) handleFiles(files);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.name.endsWith(".csv")
    );
    if (files.length) handleFiles(files);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
  };

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center min-h-screen"
      style={{ background: "var(--bg)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            boxShadow: "0 0 20px rgba(59,130,246,0.4)",
          }}
        >
          <svg viewBox="0 0 20 20" fill="none" width="20" height="20">
            <path d="M2 15l4-8 4 3 3-6 5 11H2z" fill="white" opacity=".9" />
          </svg>
        </div>
        <div>
          <h1
            className="syne text-2xl font-extrabold"
            style={{
              background: "linear-gradient(135deg, #0f1c2e, #3d5270)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Autoriders Fleet
          </h1>
          <p className="text-xs" style={{ color: "var(--text3)" }}>
            Fleet Intelligence Dashboard
          </p>
        </div>
      </div>

      <div
        className="rounded-2xl p-8 w-full max-w-md"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 4px 24px rgba(37,99,235,0.07)",
        }}
      >
        <h2 className="text-lg font-semibold mb-1 text-center" style={{ color: "var(--text)" }}>
          Upload Fleet Data
        </h2>
        <p className="text-sm mb-5 text-center" style={{ color: "var(--text3)" }}>
          Drag & drop or choose CSV / Excel files.
        </p>

        {/* Drag & drop zone */}
        {!uploading && !duplicateLabels.length && (
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className="relative rounded-xl mb-5 flex flex-col items-center justify-center gap-3 transition-all"
            style={{
              height: 180,
              border: dragging
                ? "2px dashed var(--accent2)"
                : "2px dashed var(--border2)",
              background: dragging
                ? "var(--accent-glow)"
                : "var(--surface2)",
              cursor: "pointer",
            }}
          >
            <label
              className="absolute inset-0 cursor-pointer"
              htmlFor="file-input-drop"
            />
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke={dragging ? "var(--accent2)" : "var(--text3)"}
              strokeWidth="1.5"
              style={{ transition: "stroke 0.15s" }}
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div className="text-center pointer-events-none">
              <p
                className="text-sm font-semibold"
                style={{ color: dragging ? "var(--accent2)" : "var(--text2)" }}
              >
                {dragging ? "Drop files here" : "Drag & drop files here"}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>
                or click to browse
              </p>
            </div>
            <input
              id="file-input-drop"
              type="file"
              accept=".csv,.xlsx,.xls"
              multiple
              className="hidden"
              onChange={onInputChange}
              disabled={uploading}
            />
          </div>
        )}

        {/* Uploading state */}
        {uploading && (
          <div
            className="mb-5 rounded-xl px-4 py-4 text-sm font-medium flex items-center gap-3"
            style={{
              background: "var(--accent-glow)",
              color: "var(--accent2)",
              border: "1px solid rgba(59,130,246,0.2)",
            }}
          >
            <div className="spinner" />
            {progress || "Processing…"}
          </div>
        )}

        {/* Duplicate warning */}
        {duplicateLabels.length > 0 && !uploading && (
          <div
            className="mb-5 rounded-xl px-4 py-4 text-sm text-left"
            style={{
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.3)",
              color: "#92400e",
            }}
          >
            <p className="font-semibold mb-2" style={{ color: "#b45309" }}>
              ⚠ Data already exists for:
            </p>
            <ul className="mb-3 space-y-0.5">
              {duplicateLabels.map((d) => (
                <li key={d} className="text-xs font-medium">· {d}</li>
              ))}
            </ul>
            <p className="text-xs mb-3" style={{ color: "#78350f" }}>
              Overwriting will delete all existing records for these months and replace with the new file.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleOverwrite}
                className="flex-1 text-xs font-semibold px-3 py-2 rounded-lg"
                style={{ background: "#b45309", color: "#fff" }}
              >
                Yes, overwrite
              </button>
              <button
                onClick={handleCancelOverwrite}
                className="flex-1 text-xs font-semibold px-3 py-2 rounded-lg"
                style={{
                  background: "var(--surface2)",
                  color: "var(--text2)",
                  border: "1px solid var(--border2)",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div
            className="mb-5 rounded-xl px-4 py-3 text-sm"
            style={{
              background: "rgba(239,68,68,0.08)",
              color: "#dc2626",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            {error}
          </div>
        )}

        {/* Divider */}
        {!uploading && !duplicateLabels.length && (
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <span className="text-xs" style={{ color: "var(--text3)" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          </div>
        )}

        {/* Browse button */}
        {!uploading && !duplicateLabels.length && (
          <label
            className="cursor-pointer w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--accent)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Choose File(s)
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              multiple
              className="hidden"
              onChange={onInputChange}
              disabled={uploading}
            />
          </label>
        )}

        {/* Expected columns hint */}
        <div
          className="mt-5 rounded-xl p-4 text-xs"
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            color: "var(--text3)",
          }}
        >
          Expected columns: Branch · Month · Year · Registration Number · Model ·
          FLEET · Total KMS · Total Revenue · TOTAL COST · PROFIT · Fuel cost ·
          Repair Cost · Chauff.cost · EMI
        </div>
      </div>
    </div>
  );
}