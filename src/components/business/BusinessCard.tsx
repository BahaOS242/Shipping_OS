export function BusinessCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-white p-6 ring-1 ring-sand-200/70">
      <span aria-hidden className="grid h-14 w-14 place-items-center rounded-2xl bg-sea-50 text-3xl">
        {icon}
      </span>
      <h3 className="mt-4 text-xl font-extrabold">{title}</h3>
      <p className="mt-1 text-lg text-ink-soft">{text}</p>
    </div>
  );
}
