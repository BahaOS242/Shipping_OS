"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Btn, OpsPage } from "@/components/ops/OpsPage";
import { ImportPanel } from "@/components/platform/ImportPanel";
import { ModulePicker } from "@/components/platform/ModulePicker";
import { Field, Input, Select } from "@/components/ui/Field";
import { Section } from "@/components/ui/Section";
import { useAction } from "@/components/ui/Toast";
import { useLive } from "@/data/useLive";
import { INVITABLE_ROLES, ROLE_INFO } from "@/domain/roles";
import type { StaffUser } from "@/domain/types";
import { BUSINESS_TYPES, BUSINESS_TYPE_IDS, type BusinessType } from "@/platform/businessTypes";
import { MODULES } from "@/platform/modules";
import * as svc from "@/services";

const TABS = [
  { id: "profile", label: "Profile & branding" },
  { id: "modules", label: "Modules" },
  { id: "members", label: "Members" },
  { id: "import", label: "Import data" },
] as const;
type Tab = (typeof TABS)[number]["id"];

function Settings() {
  useLive();
  const router = useRouter();
  const tab = (useSearchParams().get("tab") as Tab) ?? "profile";
  const org = svc.currentOrganization();
  return (
    <OpsPage title="Organization" sub={`${org.name} · ${BUSINESS_TYPES[org.businessType].label} · ${org.modules.length} modules enabled`}>
      <div role="tablist" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => router.replace(`/settings?tab=${t.id}`)} className={`min-h-11 rounded-xl px-4 font-bold ${tab === t.id ? "bg-ink text-white" : "bg-white ring-1 ring-[#e3e7ec]"}`}>{t.label}</button>
        ))}
      </div>
      {tab === "profile" && <Profile key={org.id} />}
      {tab === "modules" && <Modules />}
      {tab === "members" && <Members />}
      {tab === "import" && <ImportPanel />}
    </OpsPage>
  );
}

function Profile() {
  const run = useAction();
  const org = svc.currentOrganization();
  const [f, setF] = useState({ name: org.name, logoText: org.branding.logoText, primaryColor: org.branding.primaryColor, tagline: org.branding.tagline ?? "", email: org.contact.email ?? "", phone: org.contact.phone ?? "", address: org.contact.address ?? "" });
  return (
    <Section title="Profile & branding">
      <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => svc.updateOrganizationProfile(svc.currentActor(), { name: f.name, branding: { logoText: f.logoText, primaryColor: f.primaryColor, tagline: f.tagline }, contact: { email: f.email, phone: f.phone, address: f.address } }), "Saved"); }}>
        <Field label="Business name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Short name (URL)" hint="Set at sign-up; used to route API requests."><Input value={org.slug} readOnly /></Field>
        <Field label="Logo text"><Input value={f.logoText} onChange={(e) => setF({ ...f, logoText: e.target.value })} /></Field>
        <Field label="Brand color"><div className="flex gap-2"><Input type="color" value={f.primaryColor} onChange={(e) => setF({ ...f, primaryColor: e.target.value })} className="!w-16 p-1" aria-label="Pick a color" /><Input value={f.primaryColor} onChange={(e) => setF({ ...f, primaryColor: e.target.value })} /></div></Field>
        <Field label="Tagline"><Input value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} /></Field>
        <Field label="Contact email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Address"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        <div><Btn type="submit">Save</Btn></div>
      </form>
    </Section>
  );
}

function Modules() {
  const run = useAction();
  const org = svc.currentOrganization();
  const [type, setType] = useState<BusinessType>(org.businessType);
  return (
    <>
      <Section title="Start again from a preset">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Business type"><Select value={type} onChange={(e) => setType(e.target.value as BusinessType)}>{BUSINESS_TYPE_IDS.map((t) => <option key={t} value={t}>{BUSINESS_TYPES[t].label}</option>)}</Select></Field>
          <Btn tone="light" onClick={() => confirm(`Replace your modules with the ${BUSINESS_TYPES[type].label} preset?`) && run(() => svc.applyBusinessType(svc.currentActor(), type), "Preset applied")}>Apply preset</Btn>
        </div>
      </Section>
      <Section title="Modules" action={<span className="text-sm text-ink-mute">Dependencies turn on automatically. Navigation, pages and services follow these settings.</span>}>
        <ModulePicker
          modules={org.modules}
          onToggle={(id, on) => run(() => svc.setModuleEnabled(svc.currentActor(), id, on), (r) => [r.added.length ? `On: ${r.added.map((m) => MODULES[m].label).join(", ")}` : "", r.removed.length ? `Off: ${r.removed.map((m) => MODULES[m].label).join(", ")}` : ""].filter(Boolean).join(" · ") || "No change")}
        />
      </Section>
    </>
  );
}

function Members() {
  const run = useAction();
  const [f, setF] = useState({ name: "", email: "", role: "dispatcher" as StaffUser["role"] });
  return (
    <>
      <Section title={`Members (${svc.listMembers().length})`} pad={false}>
        <ul className="divide-y divide-[#eef1f4]">
          {svc.listMembers().map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
              <span><span className="font-bold">{u.name}</span> <span className="text-sm text-ink-mute">{u.email ?? ""} · {u.title}</span></span>
              <span className="flex items-center gap-2 text-sm">{ROLE_INFO[u.role].icon} {INVITABLE_ROLES.find((r) => r.role === u.role)?.label ?? u.role}{u.status === "invited" && <Btn tone="light" onClick={() => run(() => svc.acceptInvite(u.id), `${u.name} accepted (demo)`)}>Simulate accept</Btn>}</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Invite someone">
        <form className="grid gap-3 md:grid-cols-4" onSubmit={(e) => { e.preventDefault(); if (run(() => svc.inviteUser(svc.currentActor(), f), (u) => `Invitation sent to ${u.email} (demo)`)) setF({ ...f, name: "", email: "" }); }}>
          <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Role"><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as StaffUser["role"] })}>{INVITABLE_ROLES.map((r) => <option key={r.role} value={r.role}>{r.label}</option>)}</Select></Field>
          <div className="flex items-end"><Btn type="submit">Invite</Btn></div>
        </form>
      </Section>
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <Settings />
    </Suspense>
  );
}
