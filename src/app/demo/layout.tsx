import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Interactive demo — one operating system for your logistics operation",
  description: "Choose your operation — freight forwarder, mailboat, courier, warehouse, charter or full logistics — and click through Shipping OS configured for it.",
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
