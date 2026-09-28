import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: { default: "The Link — From checkout to your doorstep", template: "%s · The Link" },
  description: "Your simple way to shop, ship, track and receive in The Bahamas. (Product demo)",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0a7f8b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
