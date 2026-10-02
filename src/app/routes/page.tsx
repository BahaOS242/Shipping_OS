"use client";

import { useState } from "react";
import { Btn, OpsPage } from "@/components/ops/OpsPage";
import { Field, Input, Select } from "@/components/ui/Field";
import { Section } from "@/components/ui/Section";
import { useAction } from "@/components/ui/Toast";
import { useLive } from "@/data/useLive";
import type { DestinationId, Port, ServiceLevel } from "@/domain/types";
import * as svc from "@/services";

export default function RoutesPage() {
  useLive();
  const run = useAction();
  const actor = svc.currentActor();
  const ports = svc.listPorts();
  const routes = svc.listRoutes();
  const islands = svc.getDestinations();
  const [port, setPort] = useState({ code: "", name: "", kind: "dock" as Port["kind"], destinationId: "" });
  const [route, setRoute] = useState({ code: "", mode: "ocean" as ServiceLevel, from: "", to: "", transitHours: "8" });
  const portName = (id: string) => ports.find((p) => p.id === id)?.name ?? id;
  return (
    <OpsPage title="Routes & ports" sub="The islands you serve, the ports you call at, and the routes between them.">
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title={`Routes (${routes.length})`} pad={false}>
          <ul className="divide-y divide-[#eef1f4]">
            {routes.map((r) => (
              <li key={r.id} className="px-5 py-3">
                <p className="font-bold"><span className="font-mono">{r.code}</span> · {r.name}</p>
                <p className="text-sm text-ink-soft">{r.mode === "ocean" ? "🚢 Sea" : "✈️ Air"} · {r.portIds.map(portName).join(" → ")} · ~{r.transitHours} h</p>
              </li>
            ))}
            {!routes.length && <li className="px-5 py-6 text-ink-mute">No routes yet.</li>}
          </ul>
        </Section>
        <Section title={`Ports (${ports.length})`} pad={false}>
          <ul className="divide-y divide-[#eef1f4]">
            {ports.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 px-5 py-3 text-sm">
                <span><span className="font-mono font-bold">{p.code}</span> · {p.name}</span>
                <span className="text-ink-soft">{p.kind} · {islands.find((i) => i.id === p.destinationId)?.name ?? "outside network"}</span>
              </li>
            ))}
            {!ports.length && <li className="px-5 py-6 text-ink-mute">No ports yet.</li>}
          </ul>
        </Section>
      </div>
      <Section title="Add a port">
        <form className="grid gap-3 md:grid-cols-5" onSubmit={(e) => { e.preventDefault(); if (run(() => svc.createPort(actor, { ...port, destinationId: (port.destinationId || undefined) as DestinationId | undefined }), (p) => `Port ${p.code} added`)) setPort({ ...port, code: "", name: "" }); }}>
          <Field label="Code"><Input value={port.code} onChange={(e) => setPort({ ...port, code: e.target.value })} placeholder="GGT" /></Field>
          <Field label="Name"><Input value={port.name} onChange={(e) => setPort({ ...port, name: e.target.value })} placeholder="George Town, Exuma" /></Field>
          <Field label="Type"><Select value={port.kind} onChange={(e) => setPort({ ...port, kind: e.target.value as Port["kind"] })}><option value="dock">Dock</option><option value="seaport">Seaport</option><option value="airport">Airport</option></Select></Field>
          <Field label="Island"><Select value={port.destinationId} onChange={(e) => setPort({ ...port, destinationId: e.target.value })}><option value="">Outside network</option>{islands.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</Select></Field>
          <div className="flex items-end"><Btn type="submit">Add port</Btn></div>
        </form>
      </Section>
      <Section title="Add a route">
        <form className="grid gap-3 md:grid-cols-6" onSubmit={(e) => { e.preventDefault(); if (run(() => svc.createRoute(actor, { code: route.code, mode: route.mode, portIds: [route.from, route.to], transitHours: Number(route.transitHours) }), (r) => `Route ${r.code} added`)) setRoute({ ...route, code: "" }); }}>
          <Field label="Code"><Input value={route.code} onChange={(e) => setRoute({ ...route, code: e.target.value })} placeholder="NAS-EXU" /></Field>
          <Field label="Mode"><Select value={route.mode} onChange={(e) => setRoute({ ...route, mode: e.target.value as ServiceLevel })}><option value="ocean">Sea</option><option value="air">Air</option></Select></Field>
          <Field label="From"><Select value={route.from} onChange={(e) => setRoute({ ...route, from: e.target.value })}><option value="">Choose…</option>{ports.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}</Select></Field>
          <Field label="To"><Select value={route.to} onChange={(e) => setRoute({ ...route, to: e.target.value })}><option value="">Choose…</option>{ports.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}</Select></Field>
          <Field label="Transit (hours)"><Input inputMode="numeric" value={route.transitHours} onChange={(e) => setRoute({ ...route, transitHours: e.target.value })} /></Field>
          <div className="flex items-end"><Btn type="submit">Add route</Btn></div>
        </form>
      </Section>
    </OpsPage>
  );
}
