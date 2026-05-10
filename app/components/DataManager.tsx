"use client";

import { useState, useEffect } from "react";
import { getStoredUser } from "../lib/auth";

interface FileInfo {
  name: string;
  sha: string;
  download_url: string;
}

interface Props {
  onClose: () => void;
  onDeleted: () => void;
}

export default function DataManager({ onClose, onDeleted }: Props) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const user = getStoredUser();

  useEffect(() => {
    fetchFiles();
  }, []);

  async function fetchFiles() {
    setLoading(true);
    try {
      const role = user?.role || "branch";
      const branch = user?.username || "";
      const res = await fetch(`/api/data?role=${role}&branch=${encodeURIComponent(branch)}`);
      const json = await res.json();
      setFiles(json.files || []);
    } catch {
      setFiles([]);
    }
    setLoading(false);
  }

  async function handleDelete(filename: string) {
    if (!user) return;
    setDeleting(filename);
    try {
      const res = await fetch("/api/data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, username: user.username }),
      });
      const json = await res.json();
      if (json.success) {
        setFiles(prev => prev.filter(f => f.name !== filename));
        setConfirmDelete(null);
        onDeleted();
      } else {
        alert("Delete failed: " + (json.error || "Unknown error"));
      }
    } catch {
      alert("Delete failed. Please try again.");
    }
    setDeleting(null);
  }

  function parseFilename(name: string): { branch: string; month: string; year: string } {
    const base = name.replace(".xlsx", "");
    const parts = base.split("-");
    if (parts.length >= 3) {
      return { branch: parts[0], month: parts[1], year: parts[2] };
    }
    return { branch: base, month: "", year: "" };
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="flex items-center justify-between px-8 py-4">
        <button
          onClick={onClose}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: "var(--text2)", background: "var(--surface2)", border: "1px solid var(--border2)" }}
        >
          ← Back to Dashboard
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-8 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold" style={{ color: "var(--text)" }}>Manage Uploaded Data</h2>
          <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>
            View and remove uploaded data files
          </p>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {loading ? (
            <div className="p-8 text-center">
              <div className="spinner mx-auto mb-3" />
              <p className="text-sm" style={{ color: "var(--text3)" }}>Loading files...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm" style={{ color: "var(--text3)" }}>No files found.</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text3)", background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                    Branch
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text3)", background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                    Month
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text3)", background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                    Year
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text3)", background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {files.map(file => {
                  const info = parseFilename(file.name);
                  const isConfirming = confirmDelete === file.name;
                  const isDeleting = deleting === file.name;

                  return (
                    <tr key={file.name} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="px-5 py-3.5 text-sm font-medium" style={{ color: "var(--text)" }}>
                        {info.branch}
                      </td>
                      <td className="px-5 py-3.5 text-sm" style={{ color: "var(--text2)" }}>
                        {info.month}
                      </td>
                      <td className="px-5 py-3.5 text-sm" style={{ color: "var(--text2)" }}>
                        {info.year}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {isConfirming ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs" style={{ color: "var(--red)" }}>Delete?</span>
                            <button
                              onClick={() => handleDelete(file.name)}
                              disabled={isDeleting}
                              className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                              style={{ color: "#fff", background: "var(--red)" }}
                            >
                              {isDeleting ? "..." : "Yes"}
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                              style={{ color: "var(--text2)", background: "var(--surface2)", border: "1px solid var(--border2)" }}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(file.name)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                            style={{ color: "var(--red)", background: "var(--red-dim)", border: "1px solid rgba(220,38,38,0.2)" }}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
