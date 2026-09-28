"use client";

/** A big, tappable choice. Selected state is shown with a check AND a ring, not color alone. */
export function ChoiceButton({
  selected,
  onClick,
  icon,
  label,
  hint,
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  icon?: string;
  label: string;
  hint?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`relative flex min-h-20 w-full items-center gap-3 rounded-2xl bg-white p-4 text-left ring-2 transition active:scale-[0.98] ${
        selected ? "bg-sea-50 ring-sea-500" : "ring-sand-200 hover:ring-sea-200"
      } ${className}`}
    >
      {icon && (
        <span aria-hidden className="text-3xl">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-extrabold leading-tight">{label}</span>
        {hint && <span className="mt-0.5 block text-sm text-ink-soft">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-black ${
          selected ? "bg-sea-600 text-white" : "ring-2 ring-sand-200"
        }`}
      >
        {selected ? "✓" : ""}
      </span>
    </button>
  );
}
