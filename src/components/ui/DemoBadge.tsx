export function DemoBadge({ children = "Demo", className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-sun-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-sun-700 ring-1 ring-sun-300 ${className}`}
    >
      <span aria-hidden>◆</span> {children}
    </span>
  );
}
