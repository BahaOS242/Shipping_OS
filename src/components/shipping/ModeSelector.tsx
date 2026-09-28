"use client";

import { RATE_CARD } from "@/domain/rates";
import type { ServiceLevel } from "@/domain/types";
import { ChoiceButton } from "./ChoiceButton";

export function ModeSelector({ value, onChange }: { value?: ServiceLevel; onChange: (m: ServiceLevel) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ChoiceButton icon="✈️" label="Faster" hint={`Air · about ${RATE_CARD.air.transit}`} selected={value === "air"} onClick={() => onChange("air")} />
      <ChoiceButton icon="🚢" label="Bigger / slower" hint={`Ocean · about ${RATE_CARD.ocean.transit}`} selected={value === "ocean"} onClick={() => onChange("ocean")} />
    </div>
  );
}
