"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { HOME } from "./homeV8Content";

const WORKFLOW = HOME.workflow.steps;

const LAST = WORKFLOW.length - 1;

/** The six-step governed workflow: one `step` state drives the rail, the detail panel and the status panel. */
export function GovernedWorkflow() {
  const [step, setStep] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = WORKFLOW[step]!;

  function select(next: number, focus = false) {
    setStep(next);
    if (focus) tabs.current[next]?.focus();
  }

  // Roving tabindex: arrows move between steps, Tab leaves the tablist.
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const keys: Record<string, number> = {
      ArrowDown: Math.min(step + 1, LAST), ArrowRight: Math.min(step + 1, LAST),
      ArrowUp: Math.max(step - 1, 0), ArrowLeft: Math.max(step - 1, 0),
      Home: 0, End: LAST,
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next, true);
  }

  return (
    <section className="workflow-core" aria-labelledby="workflow-heading">
      <div className="workflow-head">
        <div>
          <div className="workflow-kicker">{HOME.workflow.kicker}</div>
          <h3 id="workflow-heading">{HOME.workflow.heading}</h3>
        </div>
        <p>{HOME.workflow.intro}</p>
      </div>
      <div className="workflow-shell">
        <div className="workflow-nav" role="tablist" aria-label="Six-step governed workflow" aria-orientation="vertical" onKeyDown={onKeyDown}>
          {WORKFLOW.map((s, i) => (
            <button
              key={s.node}
              ref={(el) => { tabs.current[i] = el; }}
              id={`wf-tab-${i}`}
              type="button"
              role="tab"
              className={`wf-tab${i === step ? " active" : ""}`}
              aria-selected={i === step}
              aria-controls="wf-panel"
              tabIndex={i === step ? 0 : -1}
              onClick={() => select(i)}
            >
              <div className="wf-num">0{i + 1}</div>
              <div className="wf-copy"><strong>{s.title}</strong><span>{s.short}</span></div>
            </button>
          ))}
        </div>
        <div className="workflow-detail" id="wf-panel" role="tabpanel" aria-labelledby={`wf-tab-${step}`}>
          <div className="workflow-topline">
            <div className="workflow-stepmeta">{current.meta}</div>
            <div className="workflow-tagline">Tap a step to inspect the engine room.</div>
          </div>
          <div className="workflow-track" aria-hidden="true">
            <div className="workflow-fill" style={{ width: `calc(${(step / LAST) * 90}% + 10%)` }} />
            {WORKFLOW.map((s, i) => (
              <div key={s.node} className={`wf-node${i === step ? " active" : ""}${i < step ? " done" : ""}`}>
                <b>{i + 1}</b><span>{s.node}</span>
              </div>
            ))}
          </div>
          <div className="workflow-main">
            <div className="workflow-text">
              <h4>{current.title}</h4>
              <p>{current.text}</p>
              <ul className="workflow-bullets">{current.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
              <div className="wf-badge-row">{current.badges.map((b) => <span key={b} className="wf-badge">{b}</span>)}</div>
            </div>
            <aside className="workflow-mini" aria-live="polite" aria-label="Operational view">
              <div className="mini-label">Operational view</div>
              <div className="signal-ladder">
                {current.mini.map((m) => <div key={m.label}><span>{m.label}</span><small>{m.text}</small></div>)}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
