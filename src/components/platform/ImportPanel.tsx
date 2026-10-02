"use client";

import { useState } from "react";
import { Btn } from "@/components/ops/OpsPage";
import { Field, Select, Textarea } from "@/components/ui/Field";
import { Section } from "@/components/ui/Section";
import { useAction } from "@/components/ui/Toast";
import * as svc from "@/services";

/** Basic CSV import through the normal services (same validation and authorization). */
export function ImportPanel() {
  const run = useAction();
  const org = svc.currentOrganization();
  const kinds = (Object.keys(svc.IMPORT_KINDS) as svc.ImportKind[]).filter((k) => org.modules.includes(svc.IMPORT_KINDS[k].module));
  const [kind, setKind] = useState<svc.ImportKind>(kinds[0] ?? "customers");
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  return (
    <Section title="Import data (CSV)" action={<span className="text-sm text-ink-mute">Rates, services, routes and existing shipments: coming next.</span>}>
      <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
        <div className="space-y-3">
          <Field label="What are you importing?"><Select value={kind} onChange={(e) => setKind(e.target.value as svc.ImportKind)}>{kinds.map((k) => <option key={k} value={k}>{svc.IMPORT_KINDS[k].label}</option>)}</Select></Field>
          <p className="text-sm text-ink-soft">Columns: <code className="text-xs">{svc.IMPORT_KINDS[kind].columns.join(",")}</code></p>
          <Btn tone="light" onClick={() => setText(svc.IMPORT_KINDS[kind].columns.join(",") + "\n")}>Insert header row</Btn>
        </div>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); const r = run(() => svc.importCsv(svc.currentActor(), kind, text), (x) => `Imported ${x.created}${x.errors.length ? `, ${x.errors.length} skipped` : ""}`); if (r) setErrors(r.errors); }}>
          <Field label="Paste CSV"><Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-sm" /></Field>
          <Btn type="submit">Import</Btn>
          {errors.length > 0 && <ul className="list-disc pl-5 text-sm text-coral-700">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        </form>
      </div>
    </Section>
  );
}

