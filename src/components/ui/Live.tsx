"use client";

import "@/services";
import { useLive } from "@/data/useLive";

/** Renders children once the data store is live (client). Shows a skeleton before. */
export function Live({ children, fallback }: { children: () => React.ReactNode; fallback?: React.ReactNode }) {
  const live = useLive();
  if (!live) return <>{fallback ?? <PageSkeleton />}</>;
  return <>{children()}</>;
}

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-10 w-2/3 max-w-md rounded-2xl bg-sand-200/70" />
      <div className="h-5 w-1/2 max-w-sm rounded-xl bg-sand-200/60" />
      <div className="grid gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-40 rounded-[var(--radius-card)] bg-sand-200/50" />
        ))}
      </div>
    </div>
  );
}
