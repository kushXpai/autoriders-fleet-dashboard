// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import AuthGuard from "./components/AuthGuard";

export const metadata: Metadata = {
  title: "Autoriders Fleet Dashboard",
  description: "Fleet Intelligence Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <AuthGuard />
        {children}
      </body>
    </html>
  );
}