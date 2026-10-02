"use client";

/** Dispatch, driver app and proof-of-delivery screens. */
import { useRef, useState } from "react";
import type { ScreenData } from "@/demo/types";
import { useStep, useStepState } from "../DemoContext";
import { Icon } from "../Icon";
import { Badge, Button, Done, Panel } from "../ui";

/* ---------------- Dispatch ---------------- */

export function DispatchScreen({ data }: { data: ScreenData["dispatch"] }) {
  const { complete, spot } = useStep();
  const [assigned, setAssigned] = useStepState<Record<string, string>>(() => ({}));
  const [pick, setPick] = useState<Record<string, string>>({});
  const loadOf = (name: string) => data.drivers.find((d) => d.name === name)!.load + Object.values(assigned).filter((x) => x === name).length;
  const waiting = data.deliveries.filter((d) => !assigned[d.id]);
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Panel title={`Unassigned (${waiting.length})`} pad={false}>
        <ul className="divide-y divide-[#f0f2f5]">
          {data.deliveries.map((d, i) => {
            const who = assigned[d.id];
            const choice = pick[d.id] ?? data.drivers[0].name;
            return (
              <li key={d.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="text-[14px] font-bold"><span className="font-mono">{d.id}</span> · {d.customer}</p>
                  <p className="text-[13px] text-ink-soft"><Icon name="pin" className="mr-1 inline h-4 w-4 align-[-3px]" />{d.area} · {d.window} · {d.size}</p>
                </div>
                {who ? (
                  <span className="flex items-center gap-2"><Badge tone="good">{who}</Badge><Button size="sm" variant="ghost" onClick={() => { const n = { ...assigned }; delete n[d.id]; setAssigned(n); }} aria-label={`Unassign ${d.id}`}>Undo</Button></span>
                ) : (
                  <span className={`flex gap-2 rounded-md ${i === 0 ? spot("assign") : ""}`}>
                    <label className="sr-only" htmlFor={`drv-${d.id}`}>Driver for {d.id}</label>
                    <select id={`drv-${d.id}`} value={choice} onChange={(e) => setPick({ ...pick, [d.id]: e.target.value })} className="min-h-9 rounded-md bg-white px-2 text-[13px] ring-1 ring-[#cfd6de]">
                      {data.drivers.map((x) => <option key={x.name} value={x.name}>{x.name} · {x.area}</option>)}
                    </select>
                    <Button size="sm" variant="accent" onClick={() => { setAssigned({ ...assigned, [d.id]: choice }); complete(); }}>Assign</Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {waiting.length === 0 && <div className="p-4"><Done>All deliveries assigned. Each driver&apos;s app updated and customers got their tracking link.</Done></div>}
      </Panel>
      <Panel title="Drivers & workload">
        <ul className="space-y-3">
          {data.drivers.map((d) => {
            const load = loadOf(d.name);
            return (
              <li key={d.name}>
                <div className="flex items-baseline justify-between text-[13px]"><span className="font-bold">{d.name}</span><span className="text-ink-mute">{d.vehicle} · {d.area}</span></div>
                <div className="mt-1 flex gap-1" role="meter" aria-label={`${d.name} stops`} aria-valuemin={0} aria-valuemax={12} aria-valuenow={load}>
                  {Array.from({ length: 12 }, (_, i) => <span key={i} className={`h-2.5 flex-1 rounded-sm ${i < load ? (load > 9 ? "bg-coral-500" : load > 7 ? "bg-sun-500" : "bg-sea-500") : "bg-[#e8ecf0]"}`} />)}
                </div>
                <p className="text-[12px] text-ink-mute">{load} stops today</p>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}

/* ---------------- Driver phone ---------------- */

function Phone({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[2.2rem] border-[7px] border-ink bg-white shadow-[var(--shadow-lift)]" aria-label={label}>
      <div className="flex items-center justify-between bg-ink px-5 pb-2 pt-1 text-[11px] font-bold text-white"><span>9:41</span><span className="flex items-center gap-1"><Icon name="globe" className="h-3 w-3" />3G</span></div>
      {children}
    </div>
  );
}

export function DriverScreen({ data }: { data: ScreenData["driver"] }) {
  const { complete, spot } = useStep();
  const [s, set] = useStepState<{ started: boolean; arrived: boolean }>(() => ({ started: false, arrived: false }));
  const [first, ...rest] = data.stops;
  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
      <Phone label={`${data.driver}'s driver app`}>
        <div className="bg-sea-700 px-4 py-3 text-white">
          <p className="text-[12px] opacity-80">{data.vehicle}</p>
          <p className="text-lg font-black">{s.started ? "On the road" : `Good afternoon, ${data.driver.split(" ")[0]}`}</p>
          <p className="text-[12px] opacity-80">{data.stops.length} stops · works offline</p>
        </div>
        <ol className="divide-y divide-[#f0f2f5]">
          {data.stops.map((st, i) => {
            const current = s.started && i === 0;
            return (
              <li key={st.id} className={`px-4 py-3 ${current ? "bg-sea-50" : ""}`}>
                <p className="flex items-center gap-2 text-[13px] font-bold"><span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${current ? "bg-sea-600 text-white" : "bg-[#eef1f4]"}`}>{i + 1}</span>{st.customer}{current && <Badge tone={s.arrived ? "good" : "info"}>{s.arrived ? "Arrived" : "Next"}</Badge>}</p>
                <p className="pl-8 text-[12px] text-ink-soft">{st.address} · {st.window}</p>
                {st.note && <p className="pl-8 text-[12px] text-sun-700">{st.note}</p>}
              </li>
            );
          })}
        </ol>
        <div className="border-t border-[#eef1f4] p-4">
          {!s.started && <Button className={`w-full ${spot("start-btn")}`} variant="accent" icon="truck" onClick={() => set({ ...s, started: true })}>Start run</Button>}
          {s.started && !s.arrived && <Button className={`w-full ${spot("start-btn")}`} icon="pin" onClick={() => { set({ ...s, arrived: true }); complete(); }}>Arrived at {first.customer}</Button>}
          {s.arrived && <p className="text-center text-[13px] font-bold text-emerald-700">✓ Arrival logged · customer told “{data.driver.split(" ")[0]} is outside”</p>}
        </div>
      </Phone>
      <Panel title="Meanwhile, at dispatch">
        <ul className="space-y-3 text-[13px] text-ink-soft">
          <li className="flex gap-2"><Icon name="pin" className="h-4 w-4 shrink-0 text-ink" />{s.started ? `${data.driver} is on the road — ${data.stops.length} stops, first: ${first.customer}.` : "Waiting for the driver to start the run."}</li>
          <li className="flex gap-2"><Icon name="chat" className="h-4 w-4 shrink-0 text-ink" />{s.arrived ? `${first.customer} got a WhatsApp: “Your driver has arrived.”` : "Customers are messaged automatically as the driver moves."}</li>
          <li className="flex gap-2"><Icon name="globe" className="h-4 w-4 shrink-0 text-ink" />No signal on a stop? The app queues updates and syncs when coverage returns.</li>
          {rest.length > 0 && <li className="flex gap-2"><Icon name="clock" className="h-4 w-4 shrink-0 text-ink" />Then: {rest.map((r) => r.customer).join(", ")}.</li>}
        </ul>
      </Panel>
    </div>
  );
}

/* ---------------- Proof of delivery ---------------- */

type PodState = { recipient: string; signed: boolean; photo: boolean; completed: boolean; at: string };

export function PodScreen({ data }: { data: ScreenData["pod"] }) {
  const { complete, spot } = useStep();
  const [s, set] = useStepState<PodState>(() => ({ recipient: "", signed: false, photo: false, completed: false, at: "" }));
  const [path, setPath] = useState("");
  const drawing = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const point = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return `${Math.round(((e.clientX - r.left) / r.width) * 300)},${Math.round(((e.clientY - r.top) / r.height) * 100)}`;
  };
  const ready = s.recipient.trim().length > 1 && s.signed && s.photo;
  const message = data.notify.replace("{recipient}", s.recipient || "—").replace("{time}", s.at);
  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
      <Phone label="Proof of delivery capture">
        <div className="space-y-3 p-4">
          <div><p className="font-mono text-[13px] font-bold">{data.ref}</p><p className="font-bold">{data.customer}</p><p className="text-[12px] text-ink-soft">{data.address} · {data.items}</p></div>
          <fieldset disabled={s.completed} className={`space-y-3 rounded-md ${spot("pod-form")}`}>
            <label className="block text-[12px] font-bold text-ink-soft">Received by
              <input value={s.recipient} onChange={(e) => set({ ...s, recipient: e.target.value })} placeholder="Name of person" className="mt-1 min-h-11 w-full rounded-md px-3 text-[14px] ring-1 ring-[#cfd6de]" />
            </label>
            <div>
              <p className="text-[12px] font-bold text-ink-soft">Signature</p>
              <svg
                ref={svgRef}
                viewBox="0 0 300 100"
                className="mt-1 h-24 w-full touch-none rounded-md bg-[#f6f8fa] ring-1 ring-[#cfd6de]"
                role="img"
                aria-label={s.signed ? "Signature captured" : "Signature pad — draw with a finger or mouse, or use the button below"}
                onPointerDown={(e) => { drawing.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); setPath((p) => `${p} M${point(e)}`); }}
                onPointerMove={(e) => drawing.current && setPath((p) => `${p} L${point(e)}`)}
                onPointerUp={() => { drawing.current = false; if (path.length > 12) set({ ...s, signed: true }); }}
              >
                <path d={path || (s.signed ? "M20,70 C60,20 80,90 120,50 S180,30 200,60 S260,40 280,55" : "")} fill="none" stroke="#0f1d2b" strokeWidth={2.5} strokeLinecap="round" />
                {!path && !s.signed && <text x="150" y="58" textAnchor="middle" fontSize="12" fill="#6b7787">Sign here</text>}
              </svg>
              {!s.signed && <button className="mt-1 min-h-9 text-[12px] font-bold text-sea-700 underline" onClick={() => set({ ...s, signed: true })}>Capture signature</button>}
            </div>
            <button onClick={() => set({ ...s, photo: !s.photo })} aria-pressed={s.photo} className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-md text-[13px] font-bold ring-1 ${s.photo ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-white ring-[#cfd6de]"}`}>
              <Icon name="camera" className="h-4 w-4" />{s.photo ? "Photo attached · 1" : "Take photo"}
            </button>
          </fieldset>
          {!s.completed ? (
            <Button className="w-full" variant="accent" icon="check" disabled={!ready} onClick={() => { set({ ...s, completed: true, at: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) }); complete(); }}>Complete delivery</Button>
          ) : (
            <p className="text-center text-[13px] font-bold text-emerald-700">✓ Delivered · GPS and time stamped</p>
          )}
        </div>
      </Phone>
      <div className="space-y-4">
        <Panel title="Proof on file">
          <ul className="grid gap-2 text-[13px] sm:grid-cols-2">
            {[["Recipient", s.recipient || "—"], ["Signature", s.signed ? "Captured" : "—"], ["Photo", s.photo ? "1 photo" : "—"], ["Location", s.completed ? "25.05°N 77.34°W (simulated)" : "—"]].map(([k, v]) => (
              <li key={k} className="rounded-md bg-[#f6f8fa] p-2"><span className="block text-[11px] font-bold uppercase text-ink-mute">{k}</span><b>{v}</b></li>
            ))}
          </ul>
        </Panel>
        <Panel title="Customer notification">
          {s.completed ? (
            <p className="max-w-sm rounded-lg rounded-tl-none bg-wa-bubble p-3 text-[13px] leading-snug shadow-sm motion-safe:animate-rise">{message}<span className="mt-1 block text-right text-[10px] text-ink-mute">WhatsApp · just now ✓✓</span></p>
          ) : (
            <p className="text-[13px] text-ink-mute">Sent on WhatsApp the moment the delivery is completed.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
