"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CustomerView } from "@/components/customer/CustomerView";
import { ReceiptPill } from "@/components/domain/Status";
import { Extraction } from "@/components/invoice/Extraction";
import { Uploader } from "@/components/invoice/Uploader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { fmtDate } from "@/components/ui/Time";
import type { PurchaseInvoice } from "@/domain/types";
import * as svc from "@/services";

export default function ReceiptsPage() {
  return <Suspense><Receipts /></Suspense>;
}

function Receipts() {
  const sp = useSearchParams();
  const [open, setOpen] = useState<string | null>(sp.get("open"));
  const [fresh, setFresh] = useState<PurchaseInvoice | null>(null);
  return (
    <CustomerView title="My Receipts">
      {(me, actor) => {
        const list = svc.listPurchaseInvoices({ customerId: me.id });
        const current = open ? svc.findPurchaseInvoice(open) : undefined;
        return (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-4">
              <header>
                <h1 className="text-4xl font-black tracking-tight sm:text-5xl">My Receipts</h1>
                <p className="mt-1 text-xl text-ink-soft">Upload the store receipt. We read it and link it to your package.</p>
              </header>
              <Uploader key={sp.get("package") ?? "none"} actor={actor} customerId={me.id} packageId={sp.get("package") ?? undefined} onDone={(inv) => setFresh(inv)} />
              {fresh && (
                <div className="animate-rise rounded-2xl bg-white p-5 ring-2 ring-sea-200">
                  <p className="text-xl font-extrabold">{fresh.packageId ? "✅ Linked to your package" : "✅ We read it"}</p>
                  <p className="text-ink-soft">{fresh.packageId ? <>This receipt is now attached to <Link className="font-bold text-sea-700 underline" href={`/packages/${fresh.packageId}`}>{fresh.packageId}</Link>. Warehouse, customs and accounting can see it.</> : "We'll link it when your package arrives."}</p>
                  <div className="mt-4"><Extraction inv={fresh} /></div>
                </div>
              )}
            </div>
            <section aria-labelledby="rl">
              <h2 id="rl" className="mb-3 text-2xl font-extrabold">Your receipts ({list.length})</h2>
              {!list.length ? (
                <EmptyState icon="🧾" title="No receipts yet">Receipts help your packages clear customs faster.</EmptyState>
              ) : (
                <ul className="space-y-2">
                  {list.map((i) => (
                    <li key={i.id}>
                      <button onClick={() => setOpen(i.id)} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white p-4 text-left ring-1 ring-sand-200 hover:ring-sea-400">
                        <span className="min-w-0">
                          <span className="block font-bold">{i.merchant} · {i.currency} {i.total.toFixed(2)}</span>
                          <span className="block truncate text-sm text-ink-mute">{i.source.fileName} · {fmtDate(i.source.uploadedAt)}{i.packageId ? ` · ${i.packageId}` : ""}</span>
                        </span>
                        <ReceiptPill status={i.status} customer />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <Modal open={!!current} onClose={() => setOpen(null)} title={current ? `${current.merchant} receipt` : ""} wide>
              {current && <Extraction inv={current} />}
            </Modal>
          </div>
        );
      }}
    </CustomerView>
  );
}
