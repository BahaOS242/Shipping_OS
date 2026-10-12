"use client";
export function PrintButton({ label = "Print label" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="rounded border px-5 py-3 print:hidden"
    >
      {label}
    </button>
  );
}
