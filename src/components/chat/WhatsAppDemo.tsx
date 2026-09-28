"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buildInboundPayload, type WaOutbound, type WaWebhookPayload } from "@/lib/channels/whatsapp";
import { demo, useDemoStore } from "@/lib/demo-store";
import { RichText } from "./RichText";

type Button = { id: string; title: string };

const STARTERS = ["Hey, where's my package?", "How much does 20 lbs cost?", "Can I talk to a person?"];

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/**
 * Mock WhatsApp client.
 *
 * It does NOT fake the conversation. It posts real Cloud-API-shaped webhook
 * payloads to /api/channels/whatsapp/webhook and renders the outbound
 * payloads the server would send to Meta. The thread itself lives in the
 * shared demo store, so staff replies from /admin show up here too.
 */
export function WhatsAppDemo({ customerId, phone, name }: { customerId: string; phone: string; name: string }) {
  const router = useRouter();
  const state = useDemoStore();
  const thread = state.conversations.find((c) => c.channel === "whatsapp" && c.customerId === customerId);
  const messages = thread?.messages ?? [];

  const [buttons, setButtons] = useState<Button[]>([]);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [hood, setHood] = useState(false);
  const [last, setLast] = useState<{ inbound: WaWebhookPayload; outbound: WaOutbound[]; tools: string[] } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const from = phone.replace(/\D/g, "");

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length, typing, buttons.length]);

  async function deliver(msg: { text: string } | { buttonId: string; title: string }) {
    if (typing) return;
    const shown = "text" in msg ? msg.text : msg.title;
    setButtons([]);
    demo.log("whatsapp", customerId, "customer", shown);
    const inbound = buildInboundPayload(from, name, msg);
    setTyping(true);
    try {
      const res = await fetch("/api/channels/whatsapp/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inbound),
      });
      const json = (await res.json()) as {
        results: { outbound: WaOutbound[]; trace?: { tool: string }[]; handoff?: unknown }[];
      };
      const r = json.results[0];
      const outbound = r?.outbound ?? [];
      setLast({ inbound, outbound, tools: (r?.trace ?? []).map((t) => t.tool) });
      // Deliver outbound messages one at a time, like a real chat.
      for (const o of outbound) {
        await new Promise((res) => setTimeout(res, 650));
        const body = o.type === "text" ? o.text.body : o.interactive.body.text;
        demo.log("whatsapp", customerId, "assistant", body);
        if (o.type === "interactive") setButtons(o.interactive.action.buttons.map((b) => b.reply));
      }
      if (r?.handoff) demo.escalateConversation("whatsapp", customerId);
    } finally {
      setTyping(false);
    }
  }

  function press(b: Button) {
    if (b.id.startsWith("link:")) {
      router.push(b.id.slice(5));
      return;
    }
    void deliver({ buttonId: b.id, title: b.title });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr] lg:items-start">
      {/* Phone */}
      <div className="mx-auto w-full max-w-[400px]">
        <div className="overflow-hidden rounded-[2.5rem] bg-black p-2.5 shadow-[var(--shadow-lift)]">
          <div className="flex h-[640px] max-h-[75vh] flex-col overflow-hidden rounded-[2rem] bg-wa-bg">
            {/* WA header */}
            <div className="flex items-center gap-3 bg-wa-dark px-4 pb-3 pt-4 text-white">
              <span aria-hidden className="text-xl">‹</span>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white" aria-hidden>
                <svg viewBox="0 0 40 40" className="h-8 w-8">
                  <circle cx="16" cy="20" r="7.5" fill="none" stroke="#0a7f8b" strokeWidth="3.5" />
                  <circle cx="24" cy="20" r="7.5" fill="none" stroke="#ffc72c" strokeWidth="3.5" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 font-bold leading-tight">
                  The Link <span className="grid h-4 w-4 place-items-center rounded-full bg-wa-green text-[10px] text-white" aria-label="verified business">✓</span>
                </p>
                <p className="text-xs text-white/75">{typing ? "typing…" : "Business account · Demo"}</p>
              </div>
            </div>

            {/* Thread */}
            <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4" aria-live="polite" aria-label="WhatsApp conversation">
              <p className="mx-auto w-fit rounded-lg bg-sun-50 px-3 py-1.5 text-center text-xs text-sun-700 shadow-sm">
                🔒 Demo chat — no real WhatsApp messages are sent.
              </p>
              {messages.length === 0 && (
                <p className="mx-auto mt-6 w-fit rounded-lg bg-white/80 px-3 py-1.5 text-center text-sm text-ink-soft">
                  Tap a message below to start 👇
                </p>
              )}
              {messages.map((m) => {
                const mine = m.author === "customer";
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] animate-rise rounded-xl px-3 py-2 text-[15px] leading-snug text-[#111b21] shadow-sm ${
                        mine ? "rounded-tr-sm bg-wa-bubble" : "rounded-tl-sm bg-white"
                      }`}
                    >
                      {m.author === "staff" && (
                        <p className="mb-0.5 text-xs font-bold text-coral-700">
                          {m.staffName ?? "The Link team"} · a real person
                        </p>
                      )}
                      <RichText text={m.text} whatsapp />
                      <span className="ml-2 float-right mt-1 text-[11px] text-[#667781]">
                        {time(m.at)} {mine && <span className="text-sky-500">✓✓</span>}
                      </span>
                    </div>
                  </div>
                );
              })}
              {buttons.length > 0 && !typing && (
                <div className="ml-0 max-w-[85%] space-y-1">
                  {buttons.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => press(b)}
                      className="flex min-h-11 w-full animate-rise items-center justify-center gap-1.5 rounded-xl bg-white text-[15px] font-semibold text-wa-teal shadow-sm hover:bg-[#f5f6f6]"
                    >
                      {b.id.startsWith("link:") ? "↗" : "↩"} {b.title}
                    </button>
                  ))}
                </div>
              )}
              {typing && (
                <div className="flex w-16 items-center justify-center gap-1 rounded-xl rounded-tl-sm bg-white px-3 py-3 shadow-sm">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-[#8696a0]" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Starters */}
            <div className="flex gap-1.5 overflow-x-auto px-2 pb-1 [scrollbar-width:none]">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => deliver({ text: s })}
                  disabled={typing}
                  className="min-h-9 shrink-0 rounded-full bg-white px-3 text-sm font-medium text-wa-teal shadow-sm disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const t = text.trim();
                if (!t) return;
                setText("");
                void deliver({ text: t });
              }}
              className="flex items-center gap-2 p-2"
            >
              <label htmlFor="wa-input" className="sr-only">
                Message
              </label>
              <input
                id="wa-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Message"
                autoComplete="off"
                className="min-h-12 min-w-0 flex-1 rounded-full bg-white px-4 text-[15px] shadow-sm focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Send"
                className="grid h-12 w-12 place-items-center rounded-full bg-wa-teal text-white shadow-sm disabled:opacity-60"
                disabled={typing}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                  <path d="M2 21 23 12 2 3v7l15 2-15 2z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Explainer */}
      <div className="space-y-4">
        <div className="rounded-[var(--radius-card)] bg-white p-6 ring-1 ring-sand-200/70">
          <h2 className="text-2xl font-extrabold">One system, every channel</h2>
          <p className="mt-2 text-lg text-ink-soft">
            WhatsApp uses the <strong>same Link Assistant</strong> and the <strong>same package data</strong> as the website. Ask
            &ldquo;where&apos;s my package?&rdquo; here and on the Help page — you get the same answer.
          </p>
          <ol className="mt-4 flex flex-wrap items-center gap-2 text-[15px] font-semibold">
            {["WhatsApp", "Webhook", "Link Assistant", "Controlled tools", "The Link API"].map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden className="text-sea-500">→</span>}
                <span className="rounded-xl bg-sand-50 px-3 py-2 ring-1 ring-sand-200">{s}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-ink-soft">
            Staff can jump in anytime from the <a className="font-bold text-sea-700 underline" href="/admin" target="_blank">staff view</a> — their
            replies appear in this chat.
          </p>
        </div>

        <div className="rounded-[var(--radius-card)] bg-ink p-5 text-white">
          <div className="flex items-center justify-between gap-3">
            <p className="font-extrabold">Under the hood 🔧</p>
            <button onClick={() => setHood((h) => !h)} aria-pressed={hood} className="min-h-10 rounded-xl px-3 text-sm font-semibold ring-1 ring-white/25 hover:bg-white/10">
              {hood ? "Hide" : "Show"} webhook payloads
            </button>
          </div>
          {!last && <p className="mt-2 text-white/70">Send a message to see the real WhatsApp Cloud API payloads.</p>}
          {last && (
            <p className="mt-2 text-white/80">
              Tools used: <span className="font-mono text-sun-300">{last.tools.join(", ") || "none"}</span>
            </p>
          )}
          {hood && last && (
            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              <Json label="Inbound webhook (from Meta)" value={last.inbound} />
              <Json label="Outbound messages (to Meta — not sent in demo)" value={last.outbound} />
            </div>
          )}
        </div>

        <button
          onClick={() => {
            demo.clearConversation("whatsapp", customerId);
            setButtons([]);
            setLast(null);
          }}
          className="text-sm font-semibold text-ink-mute underline hover:text-ink"
        >
          Clear demo chat
        </button>
      </div>
    </div>
  );
}

function Json({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-white/60">{label}</p>
      <pre className="max-h-72 overflow-auto rounded-xl bg-black/40 p-3 font-mono text-xs leading-relaxed text-emerald-200">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
