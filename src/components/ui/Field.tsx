import type { ComponentProps } from "react";

const base = "min-h-12 w-full rounded-xl bg-white px-3 text-base ring-1 ring-[#dfe4ea] focus:outline-none focus:ring-2 focus:ring-sea-500";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-mute">{hint}</span>}
    </label>
  );
}

export const Input = (p: ComponentProps<"input">) => <input {...p} className={`${base} ${p.className ?? ""}`} />;
export const Select = (p: ComponentProps<"select">) => <select {...p} className={`${base} ${p.className ?? ""}`} />;
export const Textarea = (p: ComponentProps<"textarea">) => <textarea {...p} className={`${base} py-2 ${p.className ?? ""}`} />;
