"use client";

import Link from "next/link";
import { demo, useDemoStore } from "@/lib/demo-store";

/** Shows "traveling together" after the customer consolidates (demo state). */
export function TogetherNote({ packageId, eligible }: { packageId: string; eligible: boolean }) {
  const state = useDemoStore();
  const group = demo.groupFor(state, packageId);
  if (group) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
        <span aria-hidden className="text-2xl">🔗</span>
        <p className="font-bold text-emerald-900">
          Traveling together with {group.packageIds.length - 1} other package{group.packageIds.length > 2 ? "s" : ""}.
        </p>
      </div>
    );
  }
  if (!eligible) return null;
  return (
    <Link href="/packages/together" className="flex items-center gap-3 rounded-2xl bg-sun-50 p-4 ring-1 ring-sun-300 hover:bg-sun-100">
      <span aria-hidden className="text-2xl">💡</span>
      <span className="flex-1 font-bold text-ink">Have other packages coming? Put them together and save.</span>
      <span aria-hidden className="text-xl">→</span>
    </Link>
  );
}
