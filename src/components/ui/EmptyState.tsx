export function EmptyState({ icon = "✨", title, children, action }: { icon?: string; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border-2 border-dashed border-sand-200 bg-white/60 px-6 py-10 text-center">
      <p className="text-4xl" aria-hidden>{icon}</p>
      <p className="mt-2 text-lg font-extrabold">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-ink-soft">{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
