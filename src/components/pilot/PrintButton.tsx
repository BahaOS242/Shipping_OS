"use client";
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded border px-5 py-3 print:hidden"
    >
      Print label
    </button>
  );
}
