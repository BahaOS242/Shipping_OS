"use client";

import { DEMO_SHIPPING_RULES } from "@/lib/pricing";
import type { ShippingMode } from "@/lib/types";
import { ChoiceButton } from "./ChoiceButton";

export function ModeSelector({ value, onChange }: { value?: ShippingMode; onChange: (m: ShippingMode) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ChoiceButton icon="✈️" label="Faster" hint={`By plane · about ${DEMO_SHIPPING_RULES.air.days}`} selected={value === "air"} onClick={() => onChange("air")} />
      <ChoiceButton icon="🚢" label="Bigger / slower" hint={`By boat · about ${DEMO_SHIPPING_RULES.sea.days}`} selected={value === "sea"} onClick={() => onChange("sea")} />
    </div>
  );
}
