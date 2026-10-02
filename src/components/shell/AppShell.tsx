"use client";

import "@/services";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useLive } from "@/data/useLive";
import * as svc from "@/services";
import { PageSkeleton } from "../ui/Live";
import { ToastProvider } from "../ui/Toast";
import { OPS_PREFIXES } from "@/platform/navigation";
import { CustomerShell } from "./CustomerShell";
import { DemoBar } from "./DemoBar";
import { OpsShell } from "./OpsShell";

const OPS = OPS_PREFIXES.filter((p) => !["/claims", "/support"].includes(p));
/** Same URL, different screen per role (customer view vs staff queue). */
const SHARED = ["/claims", "/support"];

const under = (p: string, list: string[]) => list.some((x) => p === x || p.startsWith(x + "/"));

let checked = false;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const live = useLive();
  useEffect(() => {
    if (live && !checked) {
      checked = true;
      svc.runSystemChecks(); // storage overdue, overdue bills, delayed shipments
      // Demo/QA hook: lets automated tests drive the same services the UI uses.
      (window as unknown as { __theLink: typeof svc }).__theLink = svc;
    }
  }, [live]);

  let content: React.ReactNode;
  // Prospect demo: its own simulated workspace, isolated from the app's data and shells.
  if (under(pathname, ["/demo"])) content = children;
  else if (under(pathname, ["/onboarding"]))
    content = (
      <div className="min-h-dvh bg-[#f4f6f8]">
        <DemoBar />
        <main id="main" className="mx-auto max-w-4xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    );
  else if (under(pathname, OPS)) content = <OpsShell>{children}</OpsShell>;
  else if (under(pathname, SHARED) && pathname !== "/claims/new")
    content = !live ? <CustomerShell><PageSkeleton /></CustomerShell> : svc.getSession().role === "customer" ? <CustomerShell>{children}</CustomerShell> : <OpsShell>{children}</OpsShell>;
  else content = <CustomerShell>{children}</CustomerShell>;
  return <ToastProvider>{content}</ToastProvider>;
}
