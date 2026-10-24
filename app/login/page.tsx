// app/login/page.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { storeUser, type User } from "../lib/auth";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = (await res.json().catch(() => ({}))) as { user?: User; error?: string };
      if (!res.ok || !body.user) {
        setError(body.error || "Sign in failed");
        setLoading(false);
        return;
      }
      storeUser(body.user);
      router.push("/");
    } catch {
      setError("Could not reach the server. Check your connection.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-10" style={{ background: "#111827" }}>
        <Image src="/autoriders.webp" alt="Autoriders Group" width={80} height={80} priority className="w-16 h-16 rounded-full object-cover" />
        <div>
          <h2 className="text-2xl font-semibold text-white leading-snug">Fleet Intelligence</h2>
          <p className="mt-3 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
            Fleet performance, revenue and branch reporting in one place.
          </p>
        </div>
        <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
          &copy; 2026 Autoriders International Limited
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8" style={{ background: "var(--bg)" }}>
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-semibold mb-1" style={{ color: "#111827" }}>
            Welcome back
          </h1>
          <p className="text-sm mb-8" style={{ color: "#64748b" }}>
            Sign in to continue
          </p>

          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#334155" }}>
                Username
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M20 21a8 8 0 1 0-16 0" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full pl-10 pr-4 py-3 rounded-md text-sm outline-none transition-all"
                  style={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    color: "#111827",
                  }}
                  autoFocus
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#334155" }}>
                Password
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-10 py-3 rounded-md text-sm outline-none transition-all"
                  style={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    color: "#111827",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                    {showPassword ? (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {error && (
              <div
                className="mb-4 text-xs font-medium px-3 py-2 rounded-md"
                style={{ background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(185,28,28,0.2)" }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full py-2.5 rounded-md text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: "#111827" }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
