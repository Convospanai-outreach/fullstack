"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import type { Sandbox } from "@/lib/marketing/sandboxes";

/**
 * A clickable walkthrough of one sample funnel. Static: no network calls, no stored data, nothing here
 * can send or save anything. Every step describes behaviour the product has today (email-first, every
 * draft reviewed by a person, reply classes are suggestions).
 */
const STEPS = [
  { id: "capture", name: "Capture", what: "The lead is saved with where it came from." },
  { id: "fit", name: "ICP fit", what: "The lead is checked against the profile of the customer you want." },
  { id: "draft", name: "AI draft", what: "A message is prepared from the account's own context." },
  { id: "approve", name: "Human approval", what: "A person reviews the draft. Nothing goes out until they approve it." },
  { id: "reply", name: "Reply sorted", what: "An incoming reply gets a suggested label that a person can correct." },
  { id: "stage", name: "Pipeline stage", what: "Stages move on buyer signals such as a reply, not on how much you sent." },
  { id: "meeting", name: "Meeting", what: "The meeting is recorded against the lead. Calendar booking is separate." },
] as const;

export function SandboxFunnel({ data }: { data: Sandbox }) {
  const [i, setI] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  // Standard tab pattern: arrows, Home and End move between tabs; only the selected tab is in the Tab order.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = STEPS.length - 1;
    const next = e.key === "ArrowRight" ? (i === last ? 0 : i + 1) : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : -1;
    if (next < 0) return;
    e.preventDefault();
    setI(next);
    tabs.current[next]?.focus();
  };
  const step = STEPS[i];
  const { prospect: p } = data;

  return (
    <div className="ph-sbx">
      <p className="ph-sbx-badge">Sample funnel · fictional data</p>
      <div className="ph-sbx-tabs" role="tablist" aria-label="Funnel steps" onKeyDown={onKeyDown}>
        {STEPS.map((s, n) => (
          <button key={s.id} ref={(el) => { tabs.current[n] = el; }} type="button" role="tab" id={`sbx-tab-${s.id}`} aria-selected={n === i} aria-controls="sbx-panel" tabIndex={n === i ? 0 : -1}
            className={n === i ? "active" : ""} onClick={() => setI(n)}>
            <span>{n + 1}</span> {s.name}
          </button>
        ))}
      </div>
      <div className="ph-sbx-panel" id="sbx-panel" role="tabpanel" aria-labelledby={`sbx-tab-${step.id}`}>
        <div>
          <h3>{step.name}</h3>
          <p>{step.what}</p>
        </div>
        <div className="ph-sbx-card">
          {step.id === "capture" && (
            <dl><dt>Name</dt><dd>{p.name}</dd><dt>Role</dt><dd>{p.role}</dd><dt>Company</dt><dd>{p.company}</dd><dt>Source</dt><dd>{p.source}</dd></dl>
          )}
          {step.id === "fit" && (
            <ul>{data.icp.map((c) => <li key={c}>{c}</li>)}</ul>
          )}
          {step.id === "draft" && (
            <><p className="ph-sbx-subject">{data.draft.subject}</p><p>{data.draft.body}</p></>
          )}
          {step.id === "approve" && (
            <><p className="ph-sbx-subject">{data.draft.subject}</p>
              <p>Status: <strong>Waiting for review</strong></p>
              <p className="ph-sbx-note">The reviewer can approve, edit or reject. Recipients, message and sender are checked first.</p></>
          )}
          {step.id === "reply" && (
            <><p className="ph-sbx-quote">&ldquo;{data.reply.text}&rdquo;</p>
              <p>Suggested label: <strong>{data.reply.label}</strong></p>
              <p className="ph-sbx-note">A suggestion only. A person confirms or corrects it.</p></>
          )}
          {step.id === "stage" && (
            <><p><strong>{data.stage.from}</strong> &rarr; <strong>{data.stage.to}</strong></p>
              <p className="ph-sbx-note">Example move after a reply that shows interest.</p></>
          )}
          {step.id === "meeting" && (
            <><p className="ph-sbx-subject">{data.meeting.title}</p><p>{data.meeting.note}</p></>
          )}
        </div>
      </div>
      <div className="ph-sbx-nav">
        <button type="button" onClick={() => setI(i - 1)} disabled={i === 0}>Back</button>
        <button type="button" onClick={() => setI(i + 1)} disabled={i === STEPS.length - 1}>Next step</button>
      </div>
      <p className="ph-source">{data.watch}</p>
    </div>
  );
}
