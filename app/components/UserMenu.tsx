// app/components/UserMenu.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, signOut } from "../lib/auth";

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const user = getStoredUser();

  const displayName = user?.username || "User";
  const initial = displayName[0].toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
        style={{ color: "var(--text2)" }}
      >
        <span
          className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
          style={{ background: "var(--text)" }}
        >
          {initial}
        </span>
        <span className="capitalize hidden sm:inline">{displayName}</span>
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1 w-40 rounded-md py-1 shadow-lg z-50"
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <button
            onClick={handleSignOut}
            className="w-full px-4 py-2 text-left text-sm transition-colors"
            style={{ color: "var(--text2)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
