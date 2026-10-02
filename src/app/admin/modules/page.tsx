"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLive } from "@/data/useLive";
import {
  MODULE_CATALOG,
  ORGANIZATION_PRESETS,
  type ModuleId,
  type OrganizationType,
} from "@/domain/modules";
import * as tenant from "@/services/tenant";

const TYPES: { id: OrganizationType; label: string; description: string }[] = [
  { id: "freight_forwarder", label: "Freight Forwarder", description: "Quotes, receiving, warehouse, manifests and customer tracking." },
  { id: "mailboat_operator", label: "Mailboat / Vessel Operator", description: "Bookings, vessels, routes, schedules, manifests and capacity." },
  { id: "charter_operator", label: "Charter Operator", description: "Charter cargo bookings, trips, capacity and manifests." },
  { id: "courier", label: "Courier", description: "Dispatch, drivers, deliveries and proof of delivery." },
  { id: "warehouse", label: "Warehouse", description: "Receiving, storage, manifests and shipment tracking." },
  { id: "logistics_company", label: "Full Logistics Company", description: "Broadest operational setup for a multi-service logistics company." },
  { id: "other", label: "Custom", description: "Start with a minimal setup and choose modules yourself." },
];

export default function PlatformPage() {
  const live = useLive();
  const router = useRouter();
  const org = live ? tenant.currentOrganization() : null;
  const [type, setType] = useState<OrganizationType>(org?.type ?? "logistics_company");
  const [name, setName] = useState(org?.name ?? "");
  const [modules, setModules] = useState<ModuleId[]>(org?.enabledModules ?? []);
  const [saved, setSaved] = useState(false);

  const grouped = useMemo(() => {
    const groups = new Map<string, ModuleId[]>();
    for (const id of Object.keys(MODULE_CATALOG) as ModuleId[]) {
      const category = MODULE_CATALOG[id].category;
      const list = groups.get(category) ?? [];
      list.push(id);
      groups.set(category, list);
    }
    return groups;
  }, []);

  if (!live || !org) return <div className="rounded-3xl bg-white p-8 ring-1 ring-[#e3e7ec]">Loading platform configuration…</div>;

  function applyPreset(nextType: OrganizationType) {
    setType(nextType);
    setModules([...(ORGANIZATION_PRESETS[nextType] ?? [])]);
    setSaved(false);
  }

  function toggle(id: ModuleId) {
    setModules((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
    setSaved(false);
  }

  function save() {
    tenant.configureOrganization({ name, type, modules });
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-wider text-sea-700">Shipping OS Platform</p>
        <h1 className="mt-1 text-3xl font-black">Configure this organization</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">One Shipping OS deployment can serve different logistics businesses. Enable only the operational modules this customer has purchased or needs.</p>
      </div>

      <section className="rounded-3xl bg-white p-5 ring-1 ring-[#e3e7ec] sm:p-7">
        <h2 className="text-lg font-black">1. Business profile</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-bold">Organization name</span>
            <input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} className="mt-1 min-h-11 w-full rounded-xl bg-[#f4f6f8] px-3 ring-1 ring-[#e3e7ec]" />
          </label>
          <label className="block">
            <span className="text-sm font-bold">Business type</span>
            <select value={type} onChange={(e) => applyPreset(e.target.value as OrganizationType)} className="mt-1 min-h-11 w-full rounded-xl bg-[#f4f6f8] px-3 ring-1 ring-[#e3e7ec]">
              {TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TYPES.map((item) => (
            <button key={item.id} onClick={() => applyPreset(item.id)} className={`rounded-2xl p-4 text-left ring-1 transition ${type === item.id ? "bg-sea-50 ring-sea-300" : "bg-white ring-[#e3e7ec] hover:bg-[#f7f9fa]"}`}>
              <p className="font-black">{item.label}</p>
              <p className="mt-1 text-sm text-ink-soft">{item.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 ring-1 ring-[#e3e7ec] sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">2. Enabled modules</h2>
            <p className="mt-1 text-sm text-ink-soft">{modules.length} modules enabled. Dependencies are automatically added when the configuration is saved.</p>
          </div>
          <button onClick={() => setModules([...ORGANIZATION_PRESETS[type]])} className="min-h-10 rounded-xl px-3 text-sm font-bold text-sea-700 ring-1 ring-[#dce5e8]">Reset to preset</button>
        </div>

        <div className="mt-5 space-y-6">
          {[...grouped.entries()].map(([category, ids]) => (
            <div key={category}>
              <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-ink-mute">{category}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ids.map((id) => {
                  const item = MODULE_CATALOG[id];
                  const enabled = modules.includes(id);
                  return (
                    <button key={id} onClick={() => toggle(id)} className={`flex min-h-24 items-start gap-3 rounded-2xl p-4 text-left ring-1 transition ${enabled ? "bg-sea-50 ring-sea-300" : "bg-white ring-[#e3e7ec]"}`}>
                      <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs font-black ${enabled ? "bg-sea-700 text-white" : "bg-[#eef1f4] text-ink-mute"}`}>{enabled ? "✓" : ""}</span>
                      <span>
                        <span className="block font-black">{item.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-ink-soft">{item.description}</span>
                        {item.dependencies?.length ? <span className="mt-1 block text-[11px] font-semibold text-ink-mute">Requires: {item.dependencies.map((x) => MODULE_CATALOG[x].label).join(", ")}</span> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-2xl bg-ink p-4 text-white shadow-lg">
        <div>
          <p className="font-black">{name || "Unnamed organization"}</p>
          <p className="text-sm text-white/70">{modules.length} modules configured</p>
        </div>
        <button onClick={save} className="min-h-11 rounded-xl bg-white px-5 font-black text-ink hover:bg-white/90">{saved ? "Saved ✓" : "Save configuration"}</button>
      </div>
    </div>
  );
}
