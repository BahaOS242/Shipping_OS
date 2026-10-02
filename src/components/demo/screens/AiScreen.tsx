"use client";

/**
 * Simulated AI moment. Answers come from the scenario's own data — no model is
 * called and nothing is executed. Drafts are shown for staff review only.
 */
import type { AiBlock, ScreenData } from "@/demo/types";
import { useStep, useStepState } from "../DemoContext";
import { Icon } from "../Icon";
import { Button, DataTable, Panel, SimulatedAi, TONE } from "../ui";
import { useDelay } from "../useReveal";

type AiState = { asked: boolean; answered: boolean; draftOpen: boolean };

function Block({ b }: { b: AiBlock }) {
  if (b.type === "text") return <p className="text-[14px] leading-relaxed">{b.text}</p>;
  if (b.type === "items")
    return (
      <ul className="space-y-2">
        {b.items.map((it) => (
          <li key={it.title} className="flex gap-3 rounded-md border border-[#eef1f4] bg-white p-3">
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${TONE[it.tone].dot}`} aria-hidden />
            <div><p className="text-[14px] font-bold">{it.title}</p><p className="text-[13px] text-ink-soft">{it.detail}</p></div>
          </li>
        ))}
      </ul>
    );
  return <div className="rounded-md border border-[#eef1f4] bg-white"><DataTable table={b.table} dense /></div>;
}

export function AiScreen({ data }: { data: ScreenData["ai"] }) {
  const { complete, spot } = useStep();
  const [s, set] = useStepState<AiState>(() => ({ asked: false, answered: false, draftOpen: false }));
  const later = useDelay();
  const ask = () => {
    set({ ...s, asked: true });
    later(() => {
      set({ asked: true, answered: true, draftOpen: false });
      complete();
    }, 1100);
  };
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <Panel title={<span className="flex items-center gap-2"><Icon name="spark" className="h-4 w-4" />Shipping OS assistant</span>} action={<SimulatedAi />}>
        <div className="space-y-4" aria-live="polite">
          {!s.asked ? (
            <div className="rounded-lg border border-dashed border-[#cfd6de] p-4">
              <p className="text-[13px] text-ink-mute">Ask about your operation in plain language.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button className={spot("ask-btn")} icon="spark" onClick={ask}>“{data.prompt}”</Button>
              </div>
              <p className="mt-3 text-[12px] text-ink-mute">Also try later: {data.suggestions.map((x) => `“${x}”`).join(" · ")}</p>
            </div>
          ) : (
            <>
              <div className="ml-auto max-w-[85%] rounded-lg rounded-br-none bg-ink px-4 py-2.5 text-[14px] text-white">{data.prompt}</div>
              {!s.answered ? (
                <p className="flex items-center gap-2 text-[13px] text-ink-mute"><span className="flex gap-1" aria-hidden><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-mute" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-mute [animation-delay:150ms]" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-mute [animation-delay:300ms]" /></span>Reading shipments, trips and messages…</p>
              ) : (
                <div className="space-y-3 rounded-lg bg-[#f6f8fa] p-4 motion-safe:animate-rise">
                  {data.answer.map((b, i) => <Block key={i} b={b} />)}
                  {data.draft && !s.draftOpen && <Button variant="accent" icon="doc" onClick={() => set({ ...s, draftOpen: true })}>{data.draft.label}</Button>}
                  {data.draft && s.draftOpen && (
                    <div className="rounded-md border-2 border-dashed border-sun-400 bg-white p-4 motion-safe:animate-rise">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-sun-700">Draft · not applied</p>
                      <p className="mt-1 font-bold">{data.draft.title}</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-ink-soft">{data.draft.lines.map((l) => <li key={l}>{l}</li>)}</ul>
                      <p className="mt-3 text-[12px] text-ink-mute">In the product, a dispatcher reviews and confirms — the assistant never applies changes on its own.</p>
                    </div>
                  )}
                  <p className="border-t border-[#e3e8ee] pt-3 text-[13px] font-semibold text-ink">{data.closing}</p>
                </div>
              )}
            </>
          )}
        </div>
      </Panel>
      <Panel title="How the assistant works">
        <ul className="space-y-3 text-[13px] text-ink-soft">
          <li className="flex gap-2"><Icon name="layers" className="h-4 w-4 shrink-0 text-ink" />Reads the same records your team works in — through permission-checked tools.</li>
          <li className="flex gap-2"><Icon name="doc" className="h-4 w-4 shrink-0 text-ink" />Prepares drafts and recommendations.</li>
          <li className="flex gap-2"><Icon name="user" className="h-4 w-4 shrink-0 text-ink" />A person confirms anything with operational or financial consequences.</li>
        </ul>
      </Panel>
    </div>
  );
}
