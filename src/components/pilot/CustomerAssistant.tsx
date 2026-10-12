"use client";
import { useState } from "react";
import Link from "next/link";
type Reply = { answer: string; links: { label: string; href: string }[] };
export function CustomerAssistant() {
  const [messages, setMessages] = useState<
      { question: string; reply: Reply }[]
    >([]),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function ask(question: string) {
    if (busy || !question.trim()) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/pilot/customer/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const reply = await r.json();
      if (!r.ok) throw new Error(reply.error);
      setMessages((prev) => [...prev.slice(-9), { question, reply }]);
      setInput("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to connect. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="rounded-2xl border bg-white p-6"
      aria-label="Customer assistant"
    >
      <p className="text-sm font-bold text-teal-700">YOUR SHIPPING HELPER</p>
      <h2 className="mt-2 text-2xl font-bold">How can I help?</h2>
      <p className="mt-3 text-slate-600">
        Ask about your packages, bills, documents or next steps. Answers use
        your account records. The team handles pricing approval, payments and
        dispatch.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {[
          "Track my packages",
          "What is my balance?",
          "Upload a receipt",
          "Ship packages together",
          "Contact a person",
        ].map((q) => (
          <button
            className="rounded-xl border px-4 py-3"
            disabled={busy}
            onClick={() => void ask(q)}
            key={q}
          >
            {q}
          </button>
        ))}
      </div>
      <div className="mt-6 space-y-5" role="log" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i}>
            <p className="ml-auto max-w-xl rounded-2xl bg-teal-700 p-4 text-white">
              {m.question}
            </p>
            <div className="mt-3 rounded-2xl bg-stone-50 p-5">
              <p className="whitespace-pre-wrap">{m.reply.answer}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {m.reply.links.map((l) => (
                  <Link
                    className="break-words font-semibold text-teal-700"
                    key={l.href}
                    href={l.href}
                  >
                    {l.label} →
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <label className="block font-semibold" htmlFor="assistant-message">
          Your question
        </label>
        <textarea
          id="assistant-message"
          className="mt-2 w-full rounded-xl border p-3"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          required
          maxLength={1000}
          placeholder="Where is my package?"
        />
        <button
          disabled={busy || !input.trim()}
          className="mt-3 rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white"
        >
          {busy ? "Checking your account…" : "Ask assistant"}
        </button>
      </form>
      {error && (
        <p className="mt-4 text-red-700" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
