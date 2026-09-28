"use client";

import type { DestinationId } from "@/domain/types";
import * as svc from "@/services";
import { ChoiceButton } from "./ChoiceButton";

/** Nassau / Abaco / Exuma / Another Island — driven by destination data, not hardcoded. */
export function DestinationSelector({ value, onChange }: { value?: DestinationId; onChange: (id: DestinationId) => void }) {
  const dests = svc.getDestinations();
  const current = dests.find((d) => d.id === value);
  const others = dests.filter((d) => d.group === "family_islands");
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {svc.DESTINATION_GROUPS.map((g) => (
          <ChoiceButton
            key={g.group}
            icon={g.icon}
            label={g.label}
            selected={current?.group === g.group}
            onClick={() => onChange(g.group === "family_islands" ? (current?.group === "family_islands" ? current.id : (g.default as DestinationId)) : (g.default as DestinationId))}
          />
        ))}
      </div>
      {current?.group === "family_islands" && (
        <label className="mt-3 block animate-rise">
          <span className="mb-1 block font-bold text-ink-soft">Which island?</span>
          <select value={value} onChange={(e) => onChange(e.target.value as DestinationId)} className="min-h-14 w-full rounded-2xl bg-white px-4 text-lg font-bold ring-2 ring-sand-200 focus:ring-sea-500">
            {others.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}
