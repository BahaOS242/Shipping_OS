"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buildInboundPayload, demoSender, handleWhatsAppWebhook, type WaOutbound, type WaWebhookPayload } from "@/ai/whatsapp";
import type { Customer } from "@/domain/types";
import * as svc from "@/services";
import { RichText } from "./RichText";

type Btn = { id: string; title: string };
const STARTERS = ["Hey, where's my package?", "How much do I owe?", "How much does 20 lbs cost?", "Can I talk to a person?"];
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/**
 * Simulated WhatsApp. Sends Cloud-API-shaped webhook payloads through the same
 * handleWhatsAppWebhook() the /api/channels/whatsapp/webhook route uses. The
 * thread is the shared conversation log: proactive notifications (package
 * received, out for delivery…) and staff replies appear here too.
 */
export function WhatsAppDemo({ me }: { me: Customer }) {
  const router = useRouter();
  const conv = svc.getConversation(me.id, "whatsapp");
  const messages = conv?.messages ?? [];
  const [buttons, setButtons] = useState<Btn[]>([]);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [hood, setHood] = useState(false);
  const [last, setLast] = useState<{ inbound: WaWebhookPayload; outbound: WaOutbound[]; tools: string[] } | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const from = me.phone.replace(/\D/g, "");
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [messages.length, typing, buttons.length]);

  async function deliver(msg: { text: string } | { buttonId: string; title: string }) {
    if (typing) return;
    setButtons([]);
    setTyping(true);
    const inbound = buildInboundPayload(from, `${me.firstName} ${me.lastName}`, msg);
    await new Promise((r) => setTimeout(r, 700));
    const res = await handleWhatsAppWebhook(inbound, demoSender);
    const r = res.results[0];
    setLast({ inbound, outbound: r?.outbound ?? [], tools: (r && "trace" in r ? r.trace ?? [] : []).map((t) => t.tool) });
    const btn = [...(r?.outbound ?? [])].reverse().find((o) => o.type === "interactive");
    if (btn && btn.type === "interactive") setButtons(btn.interactive.action.buttons.map((b) => b.reply));
    setTyping(false);
  }

  const press = (b: Btn) => (b.id.startsWith("link:") ? router.push(b.id.slice(5)) : void deliver({ buttonId: b.id, title: b.title }));

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr] lg:items-start">
      <div className="mx-auto w-full max-w-[400px]">
        <div className="overflow-hidden rounded-[2.5rem] bg-black p-2.5 shadow-[var(--shadow-lift)]">
          <div className="flex h-[660px] max-h-[78vh] flex-col overflow-hidden rounded-[2rem] bg-wa-bg">
            <div className="flex items-center gap-3 bg-wa-dark px-4 pb-3 pt-4 text-white">
              <span aria-hidden className="text-xl">‹</span>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white" aria-hidden>
                <svg viewBox="0 0 40 40" className="h-8 w-8"><circle cx="16" cy="20" r="7.5" fill="none" stroke="#0a7f8b" strokeWidth="3.5" /><circle cx="24" cy="20" r="7.5" fill="none" stroke="#ffc72c" strokeWidth="3.5" /></svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 font-bold leading-tight">Shipping OS <span className="grid h-4 w-4 place-items-center rounded-full bg-wa-green text-[10px]" aria-label="verified business">✓</span></p>
                <p className="text-xs text-white/75">{typing ? "typing…" : "Business account · Demo"}</p>
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4" aria-live="polite" aria-label="WhatsApp conversation">
              <p className="mx-auto w-fit rounded-lg bg-sun-50 px-3 py-1.5 text-center text-xs text-sun-700 shadow-sm">🔒 Simulated WhatsApp — no real messages are sent.</p>
              {!messages.length && <p className="mx-auto mt-6 w-fit rounded-lg bg-white/80 px-3 py-1.5 text-center text-sm text-ink-soft">Tap a message below to start 👇</p>}
              {messages.map((m) => {
                const mine = m.author === "customer";
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] animate-rise rounded-xl px-3 py-2 text-[15px] leading-snug text-[#111b21] shadow-sm ${mine ? "rounded-tr-sm bg-wa-bubble" : "rounded-tl-sm bg-white"}`}>
                      {m.author === "staff" && <p className="mb-0.5 text-xs font-bold text-coral-700">{m.staffName} · Shipping OS team (a real person)</p>}
                      <RichText text={m.text} whatsapp />
                      <span className="float-right ml-2 mt-1 text-[11px] text-[#667781]">{time(m.at)} {mine && <span className="text-sky-500">✓✓</span>}</span>
                    </div>
                  </div>
                );
              })}
              {buttons.length > 0 && !typing && (
                <div className="max-w-[85%] space-y-1">
                  {buttons.map((b) => <button key={b.id} onClick={() => press(b)} className="flex min-h-11 w-full animate-rise items-center justify-center gap-1.5 rounded-xl bg-white text-[15px] font-semibold text-wa-teal shadow-sm hover:bg-[#f5f6f6]">{b.id.startsWith("link:") ? "↗" : "↩"} {b.title}</button>)}
                </div>
              )}
              {typing && <div className="flex w-16 items-center justify-center gap-1 rounded-xl rounded-tl-sm bg-white px-3 py-3 shadow-sm">{[0, 150, 300].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-[#8696a0]" style={{ animationDelay: `${d}ms` }} />)}</div>}
              <div ref={end} />
            </div>
            <div className="flex gap-1.5 overflow-x-auto px-2 pb-1 [scrollbar-width:none]">
              {STARTERS.map((s) => <button key={s} onClick={() => deliver({ text: s })} disabled={typing} className="min-h-9 shrink-0 rounded-full bg-white px-3 text-sm font-medium text-wa-teal shadow-sm disabled:opacity-50">{s}</button>)}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); const t = text.trim(); if (t) { setText(""); void deliver({ text: t }); } }} className="flex items-center gap-2 p-2">
              <label htmlFor="wa-input" className="sr-only">Message</label>
              <input id="wa-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Message" autoComplete="off" className="min-h-12 min-w-0 flex-1 rounded-full bg-white px-4 text-[15px] shadow-sm focus:outline-none" />
              <button type="submit" aria-label="Send" disabled={typing} className="grid h-12 w-12 place-items-center rounded-full bg-wa-teal text-white shadow-sm disabled:opacity-60"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><path d="M2 21 23 12 2 3v7l15 2-15 2z" /></svg></button>
            </form>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-[var(--radius-card)] bg-white p-6 ring-1 ring-sand-200/70">
          <h2 className="text-2xl font-extrabold">One system, every channel</h2>
          <p className="mt-2 text-lg text-ink-soft">WhatsApp uses the <strong>same Shipping OS Assistant, tools and data</strong> as the website. Package updates you get here are the same events the warehouse creates. Staff replies from the support queue land here too.</p>
          <ol className="mt-4 flex flex-wrap items-center gap-2 text-[15px] font-semibold">
            {["WhatsApp", "Webhook", "Shipping OS Assistant", "Tools + authorization", "Services", "Data"].map((s, i) => (
              <li key={s} className="flex items-center gap-2">{i > 0 && <span aria-hidden className="text-sea-500">→</span>}<span className="rounded-xl bg-sand-50 px-3 py-2 ring-1 ring-sand-200">{s}</span></li>
            ))}
          </ol>
        </div>
        <div className="rounded-[var(--radius-card)] bg-ink p-5 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-extrabold">Under the hood 🔧</p>
            <button onClick={() => setHood((h) => !h)} aria-pressed={hood} className="min-h-10 rounded-xl px-3 text-sm font-semibold ring-1 ring-white/25 hover:bg-white/10">{hood ? "Hide" : "Show"} webhook payloads</button>
          </div>
          {!last ? <p className="mt-2 text-white/70">Send a message to see the WhatsApp Cloud API payloads.</p> : <p className="mt-2 text-white/80">Tools used: <span className="font-mono text-sun-300">{last.tools.join(", ") || "none"}</span></p>}
          {hood && last && (
            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              {[["Inbound webhook (from Meta)", last.inbound], ["Outbound messages (to Meta — not sent in demo)", last.outbound]].map(([l, v]) => (
                <div key={l as string} className="min-w-0"><p className="mb-1 text-xs font-bold uppercase tracking-wider text-white/60">{l as string}</p><pre className="max-h-72 overflow-auto rounded-xl bg-black/40 p-3 font-mono text-xs leading-relaxed text-emerald-200">{JSON.stringify(v, null, 2)}</pre></div>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => { svc.clearConversation(me.id, "whatsapp"); setButtons([]); setLast(null); }} className="text-sm font-semibold text-ink-mute underline hover:text-ink">Clear this chat</button>
      </div>
    </div>
  );
}
