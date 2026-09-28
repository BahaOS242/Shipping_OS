"use client";

import { useState } from "react";
import { Button } from "../ui/Button";

/** Demo-only lead form. Production: createSupportTicket({ type: "business_lead" }) → CRM. */
export function BusinessContact() {
  const [sent, setSent] = useState(false);
  if (sent) {
    return (
      <div className="animate-pop rounded-[var(--radius-card)] bg-white p-8 text-center text-ink">
        <p className="text-5xl" aria-hidden>🤝</p>
        <p className="mt-3 text-2xl font-extrabold">Thanks! We&apos;ll call you within 1 business day.</p>
        <p className="mt-1 text-ink-soft">(Demo — nothing was sent.)</p>
      </div>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
      }}
      className="space-y-3 rounded-[var(--radius-card)] bg-white p-6 text-ink sm:p-8"
    >
      <p className="text-2xl font-extrabold">Talk to Business Logistics</p>
      {[
        { id: "biz", label: "Business name", placeholder: "Island Hardware Co." },
        { id: "name", label: "Your name", placeholder: "First and last name" },
        { id: "phone", label: "Phone or WhatsApp", placeholder: "(242) 555-0000" },
      ].map((f) => (
        <label key={f.id} className="block">
          <span className="mb-1 block font-bold text-ink-soft">{f.label}</span>
          <input required placeholder={f.placeholder} className="min-h-14 w-full rounded-2xl bg-sand-50 px-4 text-lg ring-2 ring-sand-200 focus:outline-none focus:ring-sea-500" />
        </label>
      ))}
      <label className="block">
        <span className="mb-1 block font-bold text-ink-soft">What do you need to move?</span>
        <select className="min-h-14 w-full rounded-2xl bg-sand-50 px-4 text-lg ring-2 ring-sand-200">
          <option>Supplier shipments</option>
          <option>Inventory for my store</option>
          <option>Big / commercial freight</option>
          <option>Something every week or month</option>
          <option>I&apos;m not sure yet</option>
        </select>
      </label>
      <Button type="submit" size="xl" full variant="gold">
        Talk to Business Logistics
      </Button>
    </form>
  );
}
