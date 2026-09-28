"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Calculator } from "@/components/shipping/Calculator";
import { Live } from "@/components/ui/Live";
import type { DestinationId, ServiceLevel } from "@/domain/types";

export default function CalculatorPage() {
  return (
    <>
      <title>How much will it cost? · The Link</title>
      <header className="mb-8">
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">How much will it cost?</h1>
        <p className="mt-2 text-xl text-ink-soft">Three quick questions. No sign-up needed.</p>
      </header>
      <Suspense><Inner /></Suspense>
    </>
  );
}

function Inner() {
  const sp = useSearchParams();
  const svcParam = sp.get("service") ?? sp.get("mode");
  return (
    <Live>
      {() => (
        <Calculator
          initial={{
            to: (sp.get("to") as DestinationId) ?? undefined,
            weight: Number(sp.get("weight")) || undefined,
            service: svcParam === "air" || svcParam === "ocean" ? (svcParam as ServiceLevel) : svcParam === "sea" ? "ocean" : undefined,
          }}
        />
      )}
    </Live>
  );
}
