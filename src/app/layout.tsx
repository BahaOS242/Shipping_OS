import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://shipping-os-kappa.vercel.app"),
  title: { default: "The Link — Everything you buy, delivered to The Bahamas", template: "%s · The Link" },
  description: "Your U.S. shipping address, package receiving, consolidation, freight and local delivery — all connected. (Product demo)",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0a7f8b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-dvh font-sans antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
