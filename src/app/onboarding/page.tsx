"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Btn } from "@/components/ops/OpsPage";
import { ImportPanel } from "@/components/platform/ImportPanel";
import { ModulePicker } from "@/components/platform/ModulePicker";
import { Field, Input, Select } from "@/components/ui/Field";
import { Section } from "@/components/ui/Section";
import { useAction } from "@/components/ui/Toast";
import { useLive } from "@/data/useLive";
import { INVITABLE_ROLES } from "@/domain/roles";
import type { DestinationId, Location, Organization, StaffUser } from "@/domain/types";
import { BUSINESS_TYPES, BUSINESS_TYPE_IDS, presetModules, type BusinessType } from "@/platform/businessTypes";
import { toggleModule, type ModuleId } from "@/platform/modules";
import { destinations } from "@/data/reference";
import * as svc from "@/services";

const STEPS = ["Business type", "Organization", "Modules", "Users", "Initial data"];

type Loc = { name: string; kind: Location["kind"]; island: string; address: string };

/**
 * Onboarding: a new logistics business is configured, not forked.
 * Steps 1–3 collect the setup and create the organization in one transaction;
 * steps 4–5 run inside the new organization as its owner.
 */
export default function OnboardingPage() {
  useLive();
  const run = useAction();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<BusinessType>("freight_forwarder");
  const [modules, setModules] = useState<ModuleId[]>(presetModules("freight_forwarder"));
  const [f, setF] = useState({ name: "", slug: "", logoText: "", primaryColor: "#0a7f8b", tagline: "", email: "", phone: "", address: "", ownerName: "", ownerEmail: "" });
  const [locs, setLocs] = useState<Loc[]>([{ name: "", kind: "pickup_center", island: "nassau", address: "" }]);
  const [org, setOrg] = useState<Organization | null>(null);
  const [invite, setInvite] = useState({ name: "", email: "", role: "manager" as StaffUser["role"] });

  const pickType = (t: BusinessType) => {
    setType(t);
    setModules(presetModules(t));
  };

  function create() {
    const r = run(
      () =>
        svc.createOrganization({
          name: f.name,
          slug: f.slug || undefined,
          businessType: type,
          modules,
          branding: { logoText: f.logoText || undefined, primaryColor: f.primaryColor, tagline: f.tagline || undefined },
          contact: { email: f.email || undefined, phone: f.phone || undefined, address: f.address || undefined },
          locations: locs.filter((l) => l.name.trim()).map((l) => ({ ...l, island: (l.island || undefined) as DestinationId | undefined })),
          owner: { name: f.ownerName, email: f.ownerEmail },
        }),
      (x) => `${x.organization.name} is ready`,
    );
    if (r) {
      svc.switchOrganization(r.organization.id); // sign in as the new owner
      setOrg(r.organization);
      setStep(3);
    }
  }

  return (
    <div className="space-y-6">
      <title>Set up your organization · Shipping OS</title>
      <header>
        <p className="text-sm font-bold uppercase tracking-wider text-ink-mute">Shipping OS · new organization</p>
        <h1 className="text-3xl font-black tracking-tight">{org ? `Welcome, ${org.name}` : "Set up your logistics business"}</h1>
        <ol className="mt-4 flex flex-wrap gap-2" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? "step" : undefined} className={`rounded-full px-3 py-1 text-sm font-bold ring-1 ${i === step ? "bg-ink text-white ring-ink" : i < step ? "bg-sea-50 text-sea-800 ring-sea-200" : "bg-white text-ink-mute ring-[#e3e7ec]"}`}>{i + 1}. {s}</li>
          ))}
        </ol>
      </header>

      {step === 0 && (
        <Section title="What kind of business are you?">
          <div className="grid gap-3 md:grid-cols-2">
            {BUSINESS_TYPE_IDS.map((t) => {
              const b = BUSINESS_TYPES[t];
              return (
                <button key={t} aria-pressed={type === t} onClick={() => pickType(t)} className={`rounded-2xl p-4 text-left ring-1 ${type === t ? "bg-sea-50 ring-2 ring-sea-500" : "bg-white ring-[#e3e7ec] hover:ring-sea-300"}`}>
                  <p className="text-lg font-extrabold"><span aria-hidden>{b.icon}</span> {b.label}</p>
                  <p className="text-sm text-ink-soft">{b.blurb}</p>
                  <p className="mt-1 text-xs text-ink-mute">{presetModules(t).length} modules to start</p>
                </button>
              );
            })}
          </div>
          <div className="mt-5"><Btn onClick={() => setStep(1)}>Next</Btn></div>
        </Section>
      )}

      {step === 1 && (
        <Section title="Your organization">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Business name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, slug: f.slug || "" })} placeholder="ABC Freight" /></Field>
            <Field label="Short name (URL)" hint={`Lowercase letters, numbers and dashes. Default: ${svc.slugify(f.name) || "abc-freight"}`}><Input value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} placeholder={svc.slugify(f.name)} /></Field>
            <Field label="Logo text"><Input value={f.logoText} onChange={(e) => setF({ ...f, logoText: e.target.value })} placeholder={f.name} /></Field>
            <Field label="Brand color"><div className="flex gap-2"><Input type="color" aria-label="Pick a color" value={f.primaryColor} onChange={(e) => setF({ ...f, primaryColor: e.target.value })} className="!w-16 p-1" /><Input value={f.primaryColor} onChange={(e) => setF({ ...f, primaryColor: e.target.value })} /></div></Field>
            <Field label="Tagline"><Input value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} /></Field>
            <Field label="Contact email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Address"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
            <Field label="Owner name (you)"><Input value={f.ownerName} onChange={(e) => setF({ ...f, ownerName: e.target.value })} /></Field>
            <Field label="Owner email"><Input type="email" value={f.ownerEmail} onChange={(e) => setF({ ...f, ownerEmail: e.target.value })} /></Field>
          </div>
          <h3 className="mt-6 font-extrabold">Locations</h3>
          <div className="mt-2 space-y-2">
            {locs.map((l, i) => (
              <div key={i} className="grid gap-2 md:grid-cols-[1.2fr_1fr_1fr_1.5fr]">
                <Input aria-label="Location name" value={l.name} onChange={(e) => setLocs(locs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Location name" />
                <Select aria-label="Location type" value={l.kind} onChange={(e) => setLocs(locs.map((x, j) => (j === i ? { ...x, kind: e.target.value as Location["kind"] } : x)))}><option value="pickup_center">Pickup / office</option><option value="us_warehouse">Receiving warehouse</option><option value="partner_agent">Partner agent</option></Select>
                <Select aria-label="Island" value={l.island} onChange={(e) => setLocs(locs.map((x, j) => (j === i ? { ...x, island: e.target.value } : x)))}><option value="">Outside the islands</option>{destinations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
                <Input aria-label="Address" value={l.address} onChange={(e) => setLocs(locs.map((x, j) => (j === i ? { ...x, address: e.target.value } : x)))} placeholder="Address" />
              </div>
            ))}
            <button className="min-h-11 text-sm font-bold text-sea-700" onClick={() => setLocs([...locs, { name: "", kind: "pickup_center", island: "nassau", address: "" }])}>＋ Add location</button>
          </div>
          <div className="mt-5 flex gap-2"><Btn tone="light" onClick={() => setStep(0)}>Back</Btn><Btn onClick={() => setStep(2)}>Next</Btn></div>
        </Section>
      )}

      {step === 2 && (
        <Section title={`Modules — starting from ${BUSINESS_TYPES[type].label}`} action={<span className="text-sm text-ink-mute">{modules.length} selected · dependencies are added for you</span>}>
          <ModulePicker modules={modules} onToggle={(id, on) => setModules(toggleModule(modules, id, on))} />
          <div className="mt-5 flex gap-2"><Btn tone="light" onClick={() => setStep(1)}>Back</Btn><Btn tone="sea" onClick={create}>Create organization</Btn></div>
        </Section>
      )}

      {step === 3 && org && (
        <Section title="Invite your team">
          <form className="grid gap-3 md:grid-cols-4" onSubmit={(e) => { e.preventDefault(); if (run(() => svc.inviteUser(svc.currentActor(), invite), (u) => `Invited ${u.name}`)) setInvite({ ...invite, name: "", email: "" }); }}>
            <Field label="Name"><Input value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></Field>
            <Field label="Role"><Select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as StaffUser["role"] })}>{INVITABLE_ROLES.map((r) => <option key={r.role} value={r.role}>{r.label}</option>)}</Select></Field>
            <div className="flex items-end"><Btn type="submit">Invite</Btn></div>
          </form>
          <ul className="mt-4 space-y-1 text-sm">
            {svc.listMembers().map((u) => <li key={u.id}>👤 {u.name} · {INVITABLE_ROLES.find((r) => r.role === u.role)?.label} {u.status === "invited" && <span className="text-ink-mute">(invited)</span>}</li>)}
          </ul>
          <div className="mt-5"><Btn onClick={() => setStep(4)}>Next</Btn></div>
        </Section>
      )}

      {step === 4 && org && (
        <>
          <ImportPanel />
          <Btn tone="sea" onClick={() => router.push("/admin")}>Go to {org.name}</Btn>
        </>
      )}
    </div>
  );
}
