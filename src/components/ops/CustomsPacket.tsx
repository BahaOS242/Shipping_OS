"use client";

import * as svc from "@/services";
import { fmtDateTime } from "../ui/Time";

type Packet = ReturnType<typeof svc.customsPacket>;

/** Printable demo packet, generated from shipment data. */
export function CustomsPacketView({ p }: { p: Packet }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-xl bg-sun-50 p-3 font-bold text-sun-700 ring-1 ring-sun-300">DEMO PACKET — {p.disclaimer}</div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><p className="text-xs font-bold uppercase text-ink-mute">Consignee</p><p className="font-bold">{p.consignee.name}</p><p>{p.consignee.account} · {p.consignee.phone}</p><p>{p.consignee.address}</p></div>
        <div><p className="text-xs font-bold uppercase text-ink-mute">Shipper</p><p className="font-bold">{p.shipper.name}</p><p>{p.shipper.address}</p></div>
        <div><p className="text-xs font-bold uppercase text-ink-mute">Shipment</p><p className="font-mono font-bold">{p.shipment.id}</p><p>{p.shipment.service} → {p.shipment.destination}</p><p>{p.shipment.voyage ?? "Trip not assigned"} · generated {fmtDateTime(p.generatedAt)}</p></div>
      </div>
      <div className="overflow-x-auto rounded-xl ring-1 ring-[#e3e7ec]">
        <table className="w-full min-w-[560px] text-left">
          <thead className="bg-[#f7f9fa] text-xs text-ink-mute"><tr><th className="px-3 py-2">Package</th><th className="px-3 py-2">Merchant / invoice</th><th className="px-3 py-2">Items</th><th className="px-3 py-2 text-right">Weight</th><th className="px-3 py-2 text-right">Declared (USD)</th></tr></thead>
          <tbody className="divide-y divide-[#eef1f4]">
            {p.lines.map((l) => (
              <tr key={l.package.id}>
                <td className="px-3 py-2 font-mono">{l.package.id}</td>
                <td className="px-3 py-2">{l.merchant}<br /><span className="text-xs text-ink-mute">{l.invoice ? `${l.invoice.invoiceNumber} · ${l.currency} · ${l.document}` : "⚠ NO INVOICE"}</span></td>
                <td className="px-3 py-2">{l.items.map((i) => <span key={i.sku} className="block">{i.quantity} × {i.name}{i.reviewFlag ? " ⚠" : ""}</span>)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{l.package.actualWeight} lb</td>
                <td className="px-3 py-2 text-right tabular-nums">{l.declaredValueUsd?.toFixed(2) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="font-bold"><tr><td className="px-3 py-2" colSpan={3}>{p.totals.packages} package(s) · billable {p.totals.billableWeight} lb</td><td className="px-3 py-2 text-right">{p.totals.actualWeight} lb</td><td className="px-3 py-2 text-right">{p.totals.declaredValueUsd.toFixed(2)}</td></tr></tfoot>
        </table>
      </div>
      {p.flags.length > 0 && <ul className="space-y-1">{p.flags.map((f) => <li key={f} className="rounded-lg bg-coral-50 px-3 py-1.5 font-semibold text-coral-700">⚑ {f}</li>)}</ul>}
      {p.missing.length > 0 && <p className="rounded-lg bg-coral-50 px-3 py-2 font-semibold text-coral-700">Missing documents for: {p.missing.join(", ")}</p>}
    </div>
  );
}

/** Download a demo packet (HTML) built from the same data. */
export function downloadPacket(p: Packet) {
  const rows = p.lines.map((l) => `<tr><td>${l.package.id}</td><td>${l.merchant}<br><small>${l.invoice?.invoiceNumber ?? "NO INVOICE"}</small></td><td>${l.items.map((i) => `${i.quantity} × ${i.name}`).join("<br>")}</td><td>${l.package.actualWeight} lb</td><td>${l.declaredValueUsd?.toFixed(2) ?? "—"}</td></tr>`).join("");
  const html = `<!doctype html><meta charset="utf-8"><title>${p.title}</title><style>body{font:14px system-ui;margin:32px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px;text-align:left}.d{background:#fff3c4;padding:10px;font-weight:bold}</style><h1>${p.title}</h1><p class="d">DEMO DOCUMENT — ${p.disclaimer} Not valid for customs.</p><p><b>Consignee:</b> ${p.consignee.name} (${p.consignee.account}), ${p.consignee.address}<br><b>Shipper:</b> ${p.shipper.name}, ${p.shipper.address}<br><b>Shipment:</b> ${p.shipment.id} · ${p.shipment.service} → ${p.shipment.destination} · ${p.shipment.voyage ?? ""}</p><table><tr><th>Package</th><th>Merchant / invoice</th><th>Items</th><th>Weight</th><th>Declared USD</th></tr>${rows}</table><p><b>Total declared:</b> USD ${p.totals.declaredValueUsd.toFixed(2)} · <b>Packages:</b> ${p.totals.packages}</p>${p.flags.length ? `<p><b>Flags:</b> ${p.flags.join("; ")}</p>` : ""}`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${p.shipment.id}-demo-customs-packet.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
