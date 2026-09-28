"use client";

import { useState } from "react";
import { demo, useDemoStore } from "@/lib/demo-store";
import type { SupportTicket } from "@/lib/types";

const STAFF_NAME = "Shanice";

/**
 * Staff intervention (demo). Messages go into the customer's WhatsApp thread
 * via the shared demo store. Production: POST /api/staff/messages → WhatsApp sender.
 */
export function StaffActions({
  packageId,
  customerId,
  customerFirstName,
  suggestion,
  tickets,
}: {
  packageId: string;
  customerId: string;
  customerFirstName: string;
  suggestion: string;
  tickets: SupportTicket[];
}) {
  const state = useDemoStore();
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState(suggestion);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const escalated = state.escalatedPackages.includes(packageId);
  const notes = state.staffNotes[packageId] ?? [];

  const live = state.conversations.filter((c) => c.customerId === customerId);
  const history = tickets.filter((t) => t.customerId === customerId);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => {
            setComposing(true);
            setSent(false);
          }}
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-sea-600 px-5 text-lg font-bold text-white hover:bg-sea-700"
        >
          💬 Message Customer
        </button>
        <button
          onClick={() => demo.escalatePackage(packageId)}
          disabled={escalated}
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-lg font-bold text-coral-700 ring-2 ring-coral-100 hover:bg-coral-50 disabled:bg-coral-50 disabled:opacity-100"
        >
          {escalated ? "⚑ Escalated to supervisor" : "⚑ Escalate"}
        </button>
      </div>

      {composing && (
        <form
          className="animate-rise rounded-2xl bg-white p-5 ring-1 ring-[#e3e7ec]"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            demo.log("whatsapp", customerId, "staff", text.trim(), { staffName: `${STAFF_NAME} at The Link`, packageId });
            setSent(true);
            setComposing(false);
          }}
        >
          <label htmlFor="staff-msg" className="font-bold">
            Message {customerFirstName} on WhatsApp
          </label>
          <textarea
            id="staff-msg"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="mt-2 w-full rounded-xl bg-[#f7f9fa] p-3 text-lg ring-1 ring-[#e3e7ec] focus:outline-none focus:ring-2 focus:ring-sea-500"
          />
          <div className="mt-3 flex gap-2">
            <button type="submit" className="min-h-12 rounded-xl bg-wa-teal px-5 font-bold text-white">
              Send on WhatsApp (demo)
            </button>
            <button type="button" onClick={() => setComposing(false)} className="min-h-12 rounded-xl px-4 font-semibold text-ink-soft">
              Cancel
            </button>
          </div>
        </form>
      )}
      {sent && (
        <p className="rounded-2xl bg-emerald-50 p-4 font-semibold text-emerald-800 ring-1 ring-emerald-200">
          ✓ Sent. It now shows in {customerFirstName}&apos;s WhatsApp chat.{" "}
          <a href="/help/whatsapp" target="_blank" className="underline">
            Open customer view ↗
          </a>
        </p>
      )}

      {/* Conversations */}
      <section className="rounded-2xl bg-white ring-1 ring-[#e3e7ec]">
        <h2 className="border-b border-[#e3e7ec] px-5 py-4 text-lg font-extrabold">Conversation with {customerFirstName}</h2>
        <div className="max-h-[420px] space-y-2 overflow-y-auto p-4">
          {live.length === 0 && history.length === 0 && <p className="text-ink-mute">No messages yet.</p>}
          {live.map((c) => (
            <div key={c.id} className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">
                {c.channel === "whatsapp" ? "WhatsApp" : "Web chat"} · live {c.escalated && <span className="text-coral-700">· asked for a person</span>}
              </p>
              {c.messages.map((m) => (
                <Bubble key={m.id} author={m.author} text={m.text} who={m.staffName} />
              ))}
            </div>
          ))}
          {history.map((t) => (
            <div key={t.id} className="space-y-2 pt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">
                {t.channel === "whatsapp" ? "WhatsApp" : "Web chat"} · {t.subject}
              </p>
              {t.messages.map((m) => (
                <Bubble key={m.id} author={m.author} text={m.text} />
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Notes */}
      <section className="rounded-2xl bg-white p-5 ring-1 ring-[#e3e7ec]">
        <h2 className="text-lg font-extrabold">Add a staff note</h2>
        {notes.length > 0 && (
          <ul className="mt-2 space-y-1">
            {notes.map((n, i) => (
              <li key={i} className="rounded-lg bg-sun-50 px-3 py-2 text-ink">📝 {n}</li>
            ))}
          </ul>
        )}
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!note.trim()) return;
            demo.addStaffNote(packageId, note.trim());
            setNote("");
          }}
        >
          <label htmlFor="note" className="sr-only">Note</label>
          <input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Only staff can see notes" className="min-h-12 flex-1 rounded-xl bg-[#f7f9fa] px-3 ring-1 ring-[#e3e7ec]" />
          <button className="min-h-12 rounded-xl bg-ink px-4 font-bold text-white">Save</button>
        </form>
      </section>
    </div>
  );
}

function Bubble({ author, text, who }: { author: string; text: string; who?: string }) {
  const cls =
    author === "customer"
      ? "bg-[#eef1f4] text-ink"
      : author === "staff"
        ? "ml-auto bg-coral-50 text-ink ring-1 ring-coral-100"
        : "ml-auto bg-sea-50 text-ink";
  const label = author === "customer" ? "Customer" : author === "staff" ? (who ?? "Staff") : "Link Assistant (AI)";
  return (
    <div className={`max-w-[85%] rounded-xl px-3 py-2 ${cls}`}>
      <p className="text-xs font-bold text-ink-mute">{label}</p>
      <p className="whitespace-pre-line">{text}</p>
    </div>
  );
}
