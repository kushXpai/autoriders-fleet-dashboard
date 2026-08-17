// app/components/AuthGuard.tsx
"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getStoredUser } from "../lib/auth";

export default function AuthGuard() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Don't force a redirect loop on the login page itself
    if (pathname === "/login") return;

    const check = () => {
      if (!getStoredUser()) {
        router.push("/login");
      }
    };

    // Check once on mount (covers a fresh page load)
    check();

    // Check once whenever they come back to this tab
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);

    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [router, pathname]);

  return null;
}