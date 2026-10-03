"use client";

import ScrollFunnelHero from "./ScrollFunnelHero";
import { InviteRequestForm } from "./InviteRequestForm";

const WORKFLOW_STEPS = [
  { title: "Import or capture leads", body: "Pull contacts from LinkedIn, landing pages, or CSV. Every lead enters a shared funnel with full visibility — not someone's private inbox." },
  { title: "Draft approved email", body: "AI drafts the first message based on the buyer signal. A manager reviews it. It goes out only when cleared. No rogue sends." },
  { title: "Sync LinkedIn context", body: "Before a follow-up goes out, your team sees the captured LinkedIn profile context — name, headline, company, and location — alongside the draft." },
  { title: "Track channel status", body: "Email sent? LinkedIn messaged? Call logged? One activity timeline, one view. No &lsquo;did anyone follow up?&rsquo; conversations." },
  { title: "Review stuck leads", body: "Leads that have not moved surface automatically. Your team sees exactly what was sent and what the recommended next action is." },
  { title: "Advance funnel stage", body: "Every stage move is a deliberate, logged decision. When a lead is meeting-ready, the whole team sees it at the same time." },
];

const CRM_COMPARISON = [
  { title: "What CRMs do", items: ["Record outreach activity", "Show lead history", "Sync contacts", "Store email logs", "Log calls"] },
  { title: "What CraftMyFunnel does", items: ["Govern outreach before it happens", "Surface what needs to move now", "Sync intent signals and contact context", "Manage email drafts through approval", "Guide callers with stage-specific next steps"] },
];

const INDUSTRIES = [
  { title: "Facility Management", body: "NetJana signals — hiring surges, new locations, construction permits — tell you which accounts are in market this month. Get in early before the RFP lands." },
  { title: "Security Services", body: "Every piece of outreach touches a compliance-sensitive relationship. CraftMyFunnel routes every message through manager approval before it goes out." },
  { title: "Staffing", body: "Hiring signals are your signal. When a target company posts a wave of new roles, your team gets the LinkedIn context and a drafted outreach message in one place." },
  { title: "Consulting", body: "Relationship-led sales fall apart when context lives in one inbox. CraftMyFunnel gives every team member the full activity timeline so handoffs are smooth." },
  { title: "L&D / Training", body: "Technology adoption is your strongest buying signal. Spot new platform rollouts with NetJana and reach out with a message that is relevant, not generic." },
  { title: "Managed Services", body: "Retainer relationships start with the first impression. Governed outreach means your team presents as coordinated and professional from the very first email." },
];

const PILOT_WEEKS: [string, string][] = [
  ["Week 1", "Signal Setup"],
  ["Week 2", "Qualification Rules"],
  ["Week 3", "Multi-Channel Outreach"],
  ["Week 4", "Qualified Meetings"],
];

export default function CinematicHome() {
  return (
    <>
      <ScrollFunnelHero />
    {/* --- POST-FUNNEL SECTIONS (normal scroll, no fixed canvas) --- */}

    <div id="dashboard-preview" className="relative z-30 bg-[#070a18] text-white" style={{ scrollMarginTop: 90 }}>

      {/* ── Workflow steps ──────────────────────────────────────────────── */}
      <section className="py-24 px-6" id="workflow" tabIndex={-1} style={{ scrollMarginTop: 90 }}>
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-300/70">How it works</p>
            <h2 className="text-4xl font-black sm:text-5xl">From first signal to booked meeting — every step is governed.</h2>
            <p className="mt-4 text-lg text-slate-400">Outreach that runs like a coordinated team, not someone&apos;s solo inbox.</p>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {WORKFLOW_STEPS.map((step, i) => (
              <div key={step.title} className="glass-card p-6">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-300">Step {i + 1}</p>
                <h3 className="mt-1 text-lg font-bold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-400">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CRM comparison ──────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-[#07111f]">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-black sm:text-5xl">You have a CRM. So why are deals still slipping?</h2>
            <p className="mt-4 text-lg text-slate-400">CRMs record what happened. CraftMyFunnel governs what happens next.</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {CRM_COMPARISON.map((col) => (
              <div key={col.title} className="glass-card p-6">
                <h3 className="mb-4 text-xl font-bold text-white">{col.title}</h3>
                <ul className="space-y-3">
                  {col.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-400">
                      <span className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Industries ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6" id="industries">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-4xl font-black sm:text-5xl">Built for industries where a missed follow-up costs a contract.</h2>
          <p className="mt-4 max-w-2xl text-lg text-slate-400">Designed for service companies with long B2B cycles, multiple decision-makers, and real consequences when outreach goes quiet.</p>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {INDUSTRIES.map((ind) => (
              <div key={ind.title} className="glass-card p-6">
                <h3 className="text-lg font-bold text-white">{ind.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{ind.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pilot timeline ──────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-[#07111f]" id="pilot" tabIndex={-1} style={{ scrollMarginTop: 90 }}>
        <div className="mx-auto max-w-5xl rounded-[36px] border border-white/10 bg-gradient-to-br from-[#151a38] to-[#2b0b3d] p-10 text-center shadow-2xl sm:p-14">
          <h2 className="text-4xl font-black sm:text-5xl">Join the pilot. Run your first governed campaign in 4 weeks.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-400">We are onboarding B2B service teams who want structured, approved outreach. No setup fees. No long-term commitment.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-4">
            {PILOT_WEEKS.map(([week, title]) => (
              <div key={week} className="rounded-2xl bg-white/10 p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-cyan-200">{week}</p>
                <p className="mt-3 font-black">{title}</p>
              </div>
            ))}
          </div>
          <div className="pointer-events-auto mt-10">
            <InviteRequestForm />
          </div>
        </div>
      </section>
    </div>
    </>
  );
}
