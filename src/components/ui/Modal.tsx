"use client";

import { useEffect, useRef } from "react";

/** Accessible dialog (native <dialog>): Escape closes, focus is trapped by the browser. */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-2rem)] rounded-3xl bg-white p-0 text-ink shadow-[var(--shadow-lift)] backdrop:bg-ink/50 ${wide ? "max-w-3xl" : "max-w-lg"}`}
    >
      {open && (
        <div className="max-h-[85dvh] overflow-y-auto p-5 sm:p-7">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-xl font-extrabold sm:text-2xl">{title}</h2>
            <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl hover:bg-sand-100">
              ✕
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
