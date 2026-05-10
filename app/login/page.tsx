"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authenticate, storeUser } from "../lib/auth";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const user = authenticate(username, password);
    if (!user) {
      setError("Invalid username or password");
      setLoading(false);
      return;
    }

    storeUser(user);
    router.push("/");
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel */}
      <div
        className="hidden lg:flex lg:w-[55%] flex-col justify-between p-10 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0f1729 0%, #1a2744 50%, #0f1729 100%)" }}
      >
        {/* Logo */}
        <div>
          <img
            src="/autoriders.webp"
            alt="Autoriders Group"
            className="w-20 h-20 rounded-full object-cover"
            style={{ boxShadow: "0 0 30px rgba(59,130,246,0.3)" }}
          />
        </div>

        {/* Tagline */}
        <div>
          <h2 className="syne text-3xl font-extrabold text-white leading-tight">
            Fleet Intelligence
            <br />
            <span style={{ color: "#3b82f6" }}>made simple.</span>
          </h2>
          <p className="mt-4 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
            Manage fleet performance, track revenue, and optimize
            <br />
            operations — all in one place.
          </p>

          <div className="flex gap-8 mt-8">
            {[
              { val: "500+", label: "Vehicles" },
              { val: "15+", label: "Branches" },
              { val: "99%", label: "Uptime" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-xl font-bold text-white">{s.val}</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
          &copy; 2026 Autoriders International Limited
        </div>

        {/* Background decorative circles */}
        <div
          className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full"
          style={{ background: "rgba(26,39,68,0.8)" }}
        />
        <div
          className="absolute -bottom-16 right-32 w-64 h-64 rounded-full"
          style={{ background: "rgba(26,39,68,0.6)" }}
        />
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ background: "#f8fafc" }}>
        <div className="w-full max-w-sm">
          <h1 className="syne text-2xl font-extrabold mb-1" style={{ color: "#0f1c2e" }}>
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
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    color: "#0f1c2e",
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
                  className="w-full pl-10 pr-10 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    color: "#0f1c2e",
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
                className="mb-4 text-xs font-medium px-3 py-2 rounded-lg"
                style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.2)" }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: "#1a2744" }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
