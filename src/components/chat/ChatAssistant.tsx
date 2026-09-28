"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { handleAgentRequest } from "@/ai/agent";
import { GREETING, MAIN_MENU, SUGGESTIONS } from "@/ai/copy";
import type { AgentAction, AgentCard, AgentContext, AgentInput } from "@/ai/types";
import { fmtUsd } from "@/domain/rates";
import type { ID } from "@/domain/types";
import * as svc from "@/services";
import { RichText } from "./RichText";

type Msg = { id: string; from: "user" | "assistant"; text: string; card?: AgentCard; tools?: string[] };
let n = 0;
const uid = () => `m${++n}`;
const plain = (t: string) => t.replace(/\*\*/g, "");

/**
 * Link Assistant (web channel). Runs the same agent + controlled tools the
 * /api/agent route and WhatsApp use, against the shared data.
 */
export function ChatAssistant({ customerId, autoAsk, tall }: { customerId: ID; autoAsk?: { id: string; label: string }; tall?: boolean }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(GREETING.map((g) => ({ id: uid(), from: "assistant", text: g.text })));
  const [actions, setActions] = useState<AgentAction[]>(MAIN_MENU);
  const [context, setContext] = useState<AgentContext>({});
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [tools, setTools] = useState(false);
  const [handoff, setHandoff] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const asked = useRef(false);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [messages, busy]);

  async function send(input: AgentInput, shown: string) {
    if (busy) return;
    setBusy(true);
    setActions([]);
    setMessages((m) => [...m, { id: uid(), from: "user", text: shown }]);
    svc.logConversation(customerId, "web", "customer", shown);
    const reply = await handleAgentRequest({ channel: "web", customerId, input, context });
    await new Promise((r) => setTimeout(r, 450));
    setMessages((m) => [...m, ...reply.messages.map((x, i) => ({ id: uid(), from: "assistant" as const, text: x.text, card: x.card, tools: i === 0 ? reply.trace.map((t) => t.tool) : undefined }))]);
    reply.messages.forEach((x, i) => svc.logConversation(customerId, "web", "assistant", plain(x.text), undefined, i === 0 ? reply.intent : undefined));
    if (reply.handoff) setHandoff(reply.handoff.ticketId);
    setActions(reply.actions);
    setContext(reply.context);
    setBusy(false);
  }

  useEffect(() => {
    if (autoAsk && !asked.current) {
      asked.current = true;
      void send({ kind: "action", id: autoAsk.id, label: autoAsk.label }, autoAsk.label);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onAction = (a: AgentAction) => (a.href ? router.push(a.href) : void send({ kind: "action", id: a.id, label: a.label }, a.label));

  return (
    <div className="flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-lift)] ring-1 ring-sand-200/70">
      <div className="flex items-center justify-between gap-3 bg-sea-700 px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-sun-400 text-2xl" aria-hidden>🤖</span>
          <div><p className="text-lg font-extrabold leading-tight">Link Assistant</p><p className="flex items-center gap-1.5 text-sm text-sea-100"><span className="h-2 w-2 rounded-full bg-emerald-300" aria-hidden /> Online · simulated AI</p></div>
        </div>
        <button onClick={() => setTools((s) => !s)} aria-pressed={tools} className="min-h-10 rounded-xl px-3 text-sm font-semibold text-sea-100 ring-1 ring-white/20 hover:bg-white/10">{tools ? "Hide" : "Show"} tools 🔧</button>
      </div>
      <div className={`${tall ? "max-h-[68vh] min-h-[440px]" : "max-h-[60vh] min-h-[360px]"} flex-1 space-y-4 overflow-y-auto bg-sand-50 p-4 sm:p-6`} aria-live="polite" aria-label="Conversation">
        {messages.map((m) =>
          m.from === "user" ? (
            <div key={m.id} className="flex justify-end"><p className="max-w-[85%] animate-rise rounded-3xl rounded-br-md bg-sea-600 px-5 py-3 text-lg font-medium text-white">{m.text}</p></div>
          ) : (
            <div key={m.id} className="max-w-[92%] animate-rise">
              <div className="rounded-3xl rounded-bl-md bg-white px-5 py-4 text-lg leading-relaxed ring-1 ring-sand-200">
                <RichText text={m.text} />
                {m.card && <Card card={m.card} />}
              </div>
              {tools && m.tools && m.tools.length > 0 && <p className="mt-1.5 pl-3 font-mono text-xs text-ink-mute">🔧 {m.tools.join(" → ")} → authorization → services</p>}
            </div>
          ),
        )}
        {busy && (
          <div className="flex w-20 items-center justify-center gap-1.5 rounded-3xl rounded-bl-md bg-white px-4 py-4 ring-1 ring-sand-200" aria-label="Link Assistant is typing">
            {[0, 150, 300].map((d) => <span key={d} className="h-2.5 w-2.5 animate-bounce rounded-full bg-ink-mute" style={{ animationDelay: `${d}ms` }} />)}
          </div>
        )}
        {!busy && actions.length > 0 && (
          <div className={`grid gap-2.5 pt-1 ${actions.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {actions.map((a) => (
              <button key={a.id + a.label} onClick={() => onAction(a)} className="flex min-h-16 animate-rise items-center justify-center gap-2 rounded-2xl bg-white px-4 text-lg font-bold text-sea-800 ring-2 ring-sea-200 hover:bg-sea-50 hover:ring-sea-500 active:scale-[0.98]">
                {a.icon && <span aria-hidden className="text-2xl">{a.icon}</span>}{a.label}
              </button>
            ))}
          </div>
        )}
        {handoff && <p className="rounded-2xl bg-sun-50 p-3 text-center font-semibold text-sun-700 ring-1 ring-sun-300">🙋 A person from The Link can now see this chat ({handoff}). <Link className="underline" href="/support">See my requests</Link></p>}
        <div ref={end} />
      </div>
      <div className="border-t border-sand-200 bg-white p-3 sm:p-4">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {SUGGESTIONS.map((s) => <button key={s} onClick={() => send({ kind: "text", text: s }, s)} disabled={busy} className="min-h-10 shrink-0 rounded-full bg-sand-100 px-4 text-[15px] font-semibold text-ink-soft hover:bg-sea-50 disabled:opacity-50">{s}</button>)}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); const t = text.trim(); if (t) { setText(""); void send({ kind: "text", text: t }, t); } }} className="flex gap-2">
          <label htmlFor="chat-input" className="sr-only">Type your question</label>
          <input id="chat-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your question…" autoComplete="off" className="min-h-14 min-w-0 flex-1 rounded-2xl bg-sand-50 px-4 text-lg ring-2 ring-sand-200 focus:outline-none focus:ring-sea-500" />
          <button type="submit" disabled={busy || !text.trim()} className="min-h-14 rounded-2xl bg-sea-600 px-5 text-lg font-bold text-white disabled:opacity-40">Send</button>
        </form>
      </div>
    </div>
  );
}

function Card({ card }: { card: AgentCard }) {
  if (card.kind === "package")
    return (
      <Link href={`/packages/${card.packageId}`} className="mt-4 flex items-center gap-4 rounded-2xl bg-sea-50 p-4 ring-1 ring-sea-200 hover:ring-sea-500">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold uppercase tracking-wide text-sea-700">{card.merchant} · {card.packageId}</span>
          <span className="block text-xl font-black">{card.statusTitle}</span>
          <span className="block truncate text-base text-ink-soft">{card.itemName} · {card.where}</span>
        </span>
        <span aria-hidden className="text-xl text-sea-700">›</span>
      </Link>
    );
  if (card.kind === "balance")
    return <div className="mt-4 rounded-2xl bg-ink p-4 text-white"><p className="text-sm font-bold text-white/70">Balance</p><p className="text-4xl font-black text-sun-300">{fmtUsd(card.balance)}</p></div>;
  return (
    <div className="mt-4 rounded-2xl bg-ink p-4 text-white">
      <p className="text-sm font-bold uppercase tracking-wide text-white/70">Estimated cost · demo</p>
      <p className="text-4xl font-black text-sun-300">{fmtUsd(card.total)}</p>
      <p className="text-white/80">{card.weight} lb to {card.destination} · ✈️ {card.transit}</p>
    </div>
  );
}
