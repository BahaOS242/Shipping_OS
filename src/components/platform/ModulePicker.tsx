import { MODULES, MODULE_CATEGORIES, MODULE_IDS, dependentsOf, type ModuleId } from "@/platform/modules";

/**
 * Module selection with dependencies shown. Toggling is delegated to the caller,
 * which uses the platform resolver (toggleModule), so the result is always valid.
 */
export function ModulePicker({ modules, onToggle, disabled }: { modules: readonly ModuleId[]; onToggle: (id: ModuleId, enabled: boolean) => void; disabled?: boolean }) {
  return (
    <div className="space-y-6">
      {MODULE_CATEGORIES.map((cat) => (
        <fieldset key={cat.id}>
          <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-mute">{cat.label}</legend>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {MODULE_IDS.filter((m) => MODULES[m].category === cat.id).map((id) => {
              const def = MODULES[id];
              const on = modules.includes(id);
              const usedBy = dependentsOf(id).filter((d) => modules.includes(d));
              return (
                <label key={id} className={`flex cursor-pointer gap-3 rounded-2xl p-4 ring-1 transition ${on ? "bg-sea-50/60 ring-sea-300" : "bg-white ring-[#e3e7ec] hover:ring-sea-300"} ${disabled ? "pointer-events-none opacity-60" : ""}`}>
                  <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--color-sea-600)]" checked={on} disabled={disabled} onChange={(e) => onToggle(id, e.target.checked)} />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 font-bold">
                      {def.label}
                      {def.availability === "planned" && <span className="rounded-full bg-sand-100 px-2 text-[11px] font-bold text-ink-soft ring-1 ring-sand-200">Planned</span>}
                    </span>
                    <span className="block text-sm text-ink-soft">{def.description}</span>
                    {def.dependencies.length > 0 && (
                      <span className="mt-1 block text-xs text-ink-mute">
                        Requires: {def.dependencies.map((d) => `${modules.includes(d) ? "✓" : "○"} ${MODULES[d].label}`).join("  ")}
                      </span>
                    )}
                    {on && usedBy.length > 0 && <span className="mt-0.5 block text-xs text-sun-700">Turning off also turns off: {usedBy.map((d) => MODULES[d].label).join(", ")}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
