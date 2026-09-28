"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import * as svc from "@/services";
import { Button } from "../ui/Button";
import { Field, Input, Select } from "../ui/Field";

export function OpenBusinessDemo() {
  const router = useRouter();
  return (
    <Button variant="secondary" icon="🏢" onClick={() => { svc.switchCustomer("cus_kendrick"); router.push("/dashboard"); }}>
      See a business dashboard (demo)
    </Button>
  );
}

/** Demo-only lead form. Production: creates a CRM lead / sales ticket. */
export function BusinessContact() {
  const [sent, setSent] = useState(false);
  if (sent) return (
    <div className="animate-pop rounded-[var(--radius-card)] bg-white p-8 text-center text-ink">
      <p className="text-5xl" aria-hidden>🤝</p>
      <p className="mt-3 text-2xl font-extrabold">Thanks! Our business team will call you within 1 business day.</p>
      <p className="mt-1 text-ink-soft">(Demo — nothing was sent.)</p>
    </div>
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="space-y-3 rounded-[var(--radius-card)] bg-white p-6 text-ink sm:p-8">
      <p className="text-2xl font-extrabold">Talk to Business Logistics</p>
      <Field label="Business name"><Input required placeholder="Island Hardware Co." /></Field>
      <Field label="Your name"><Input required /></Field>
      <Field label="Phone or WhatsApp"><Input required inputMode="tel" placeholder="(242) 555-0000" /></Field>
      <Field label="What do you need?">
        <Select>{["Supplier shipments", "Inventory & receiving", "Commercial freight", "Buy it for us (procurement)", "Recurring shipments", "Not sure yet"].map((o) => <option key={o}>{o}</option>)}</Select>
      </Field>
      <Button type="submit" size="xl" full variant="gold">Talk to Business Logistics</Button>
    </form>
  );
}
