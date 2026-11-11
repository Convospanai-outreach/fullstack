"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { COPY_GOALS, ctaCopyWarnings, patternsFor, type CopyGoal, type CopyKind } from "@/components/landing-agent/copyPatterns";

const KIND_LABELS: Record<CopyKind, string> = {
  benefit_first: "Benefit first",
  specific_number: "Specific number",
  curiosity_gap: "Curiosity gap",
  objection_handling: "Handles an objection",
  urgency_true: "Urgency that is true",
};

// Static patterns only (no AI). Clicking one hands the text to the editor, which writes it into the
// selected text block. The draft box checks any wording the user types, with the honesty warnings.
export default function CopyHelperPanel({ onUse }: { onUse: (text: string) => boolean }) {
  const [goal, setGoal] = useState<CopyGoal>("get_leads");
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const warnings = useMemo(() => ctaCopyWarnings(draft), [draft]);
  const patterns = patternsFor(goal);

  function use(text: string) {
    setNotice(onUse(text) ? "Copied into the selected text block." : "Select a text block in the page first, then click the pattern again.");
  }

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 space-y-3">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Pick a stronger headline/CTA</p>
      <div className="flex flex-wrap gap-1">
        {COPY_GOALS.map((option) => (
          <Button
            key={option.id}
            onClick={() => setGoal(option.id)}
            className={`h-7 px-2 text-xs ${goal === option.id ? "bg-cyan-600 text-white" : "bg-white/10 text-slate-300"}`}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <ul className="space-y-2">
        {patterns.map((pattern) => (
          <li key={pattern.text} className="space-y-1">
            <p className="text-[11px] text-slate-400">{KIND_LABELS[pattern.kind]}</p>
            <Button data-pattern={pattern.text} onClick={() => use(pattern.text)} className="h-auto w-full justify-start whitespace-normal bg-white/10 px-2 py-1 text-left text-xs text-slate-100">
              {pattern.text}
            </Button>
            {pattern.kind === "urgency_true" ? <p className="text-[11px] text-amber-300">Only use this if it is true.</p> : null}
          </li>
        ))}
      </ul>
      {notice ? <p className="text-xs text-slate-300">{notice}</p> : null}
      <label className="block text-xs text-slate-300">
        Check your own wording
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 p-2 text-xs text-slate-100"
        />
      </label>
      <ul data-warnings className="space-y-1">
        {warnings.map((warning) => (
          <li key={warning.id} className="text-xs text-amber-300">
            {warning.message}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-slate-500">Type real numbers and dates yourself. Only use urgency if it is true.</p>
    </div>
  );
}
