"use client";

import { ISLANDS, MAIN_ISLANDS, OTHER_ISLANDS } from "@/lib/pricing";
import type { IslandId } from "@/lib/types";
import { ChoiceButton } from "./ChoiceButton";

export function LocationSelector({ value, onChange }: { value?: IslandId; onChange: (id: IslandId) => void }) {
  const isOther = !!value && OTHER_ISLANDS.includes(value);
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {MAIN_ISLANDS.map((id) => (
          <ChoiceButton key={id} icon="🇧🇸" label={ISLANDS[id].name} selected={value === id} onClick={() => onChange(id)} />
        ))}
        <ChoiceButton
          icon="🏝️"
          label="Another Island"
          selected={isOther}
          onClick={() => onChange(isOther ? value! : OTHER_ISLANDS[0])}
        />
      </div>
      {isOther && (
        <label className="mt-3 block animate-rise">
          <span className="mb-1 block font-bold text-ink-soft">Which island?</span>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value as IslandId)}
            className="min-h-14 w-full rounded-2xl bg-white px-4 text-lg font-bold ring-2 ring-sand-200 focus:ring-sea-500"
          >
            {OTHER_ISLANDS.map((id) => (
              <option key={id} value={id}>
                {ISLANDS[id].name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
