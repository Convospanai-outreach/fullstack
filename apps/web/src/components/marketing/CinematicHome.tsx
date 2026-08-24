"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "@/lib/useLenis";
import HudGrid from "./3d/HudGrid";
import { PILLARS, SCROLL_ACTS } from "./3d/sceneConfig";
import { InviteRequestForm } from "./InviteRequestForm";

const FunnelScene = dynamic(() => import("./3d/FunnelScene"), { ssr: false });

// ─── Static data for post-funnel sections ────────────────────────────────────
const WORKFLOW_STEPS = [
  { title: "Import or capture leads", body: "Pull contacts from LinkedIn, landing pages, or CSV. Every lead enters a shared funnel with full visibility — not someone's private inbox." },
  { title: "Draft approved email", body: "AI drafts the first message based on the buyer signal. A manager reviews it. It goes out only when cleared. No rogue sends." },
  { title: "Sync LinkedIn context", body: "Before a follow-up goes out, your team sees the full LinkedIn snapshot — recent posts, role changes, company moves." },
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



const HUD_STAGES = SCROLL_ACTS.map((a) => ({ id: a.id, label: a.label, shortLabel: a.shortLabel }));

// ─── Act copy ────────────────────────────────────────────────────────────────
const ACTS = [
  {
    id: "intake",
    eyebrow: "Act 0 — Market Intake",
    categoryBadge: "CraftMyFunnel AI Engine",
    headline: "Somewhere out there, a company needs exactly what you sell.",
    sub: "Most teams spend their week guessing who to contact. The market is moving. Your pipeline is not.",
    tag: null,
    isSolution: false,
    color: "slate",
  },
  {
    id: "leak",
    eyebrow: "The Core Problem",
    categoryBadge: null,
    headline: "Signals disappear. Follow-ups stall. Deals die between messages.",
    sub: "Manual prospecting, ungoverned mass outreach, and no rescue layer turn warm intent into lost revenue every day.",
    tag: "Outbound Crisis",
    isSolution: false,
    color: "rose",
  },
  {
    id: "shift",
    eyebrow: "The Paradigm Shift",
    categoryBadge: null,
    headline: "Market intent goes in. Governed pipeline comes out. Revenue keeps feeding the loop.",
    sub: "CraftMyFunnel AI connects four purpose-built layers so nothing leaks between signal and signed contract.",
    tag: "Governed Engine",
    isSolution: false,
    color: "indigo",
  },
  {
    id: "signal",
    eyebrow: "Layer 01 — NetJana",
    solutionBadge: "CraftMyFunnel AI — Layer 01 Solution",
    headline: "Be the first call. Never the second.",
    sub: "Monitors hiring surges, expansion, tenders, and executive movement so your team works active-market accounts — not cold lists.",
    tag: "Buyer Signals",
    solves: "Who should I reach out to this week?",
    isSolution: true,
    color: "cyan",
  },
  {
    id: "outreach",
    eyebrow: "Layer 02 — CMF Core",
    solutionBadge: "CraftMyFunnel AI — Layer 02 Solution",
    headline: "AI drafts. Managers approve. Nothing goes out unchecked.",
    sub: "Drafts hyper-personalized outreach, prepares channel context, and keeps manager approval in the loop before anything sends.",
    tag: "AI Outreach SaaS",
    solves: "How do I reach them, and how do I know it went well?",
    isSolution: true,
    color: "violet",
  },
  {
    id: "human",
    eyebrow: "Layer 03 — Human Layer",
    solutionBadge: "CraftMyFunnel AI — Layer 03 Solution",
    headline: "The deals email cannot close, your people can.",
    sub: "Caller tasks, manual stage updates, and follow-up suggestions keep high-value leads moving between message and contract.",
    tag: "Conversion Moat",
    solves: "What happens when the digital channel is not enough?",
    isSolution: true,
    color: "mint",
  },
  {
    id: "edge",
    eyebrow: "Layer 04 — Covospan EDGE",
    solutionBadge: "CraftMyFunnel AI — Layer 04 Solution",
    headline: "Their trust is the contract. Keep it with you.",
    sub: "Runs sensitive AI checks, memory logs, and outreach processing close to your own data — with encrypted local storage and on-device audit trails.",
    tag: "Sovereign Edge Node",
    solves: "How do I run this without putting sensitive client data in someone else's cloud?",
    isSolution: true,
    color: "crystal",
  },
  {
    id: "revenue",
    eyebrow: "The Output Node",
    solutionBadge: "CraftMyFunnel AI — Verified Result",
    headline: "From scattered follow-ups to qualified meetings.",
    sub: "Every signal captured, every outreach governed, every conversation rescued — compresses into pipeline your team can actually close.",
    tag: "Qualified Revenue",
    isSolution: true,
    color: "amber",
  },
] as const;

const TAG_COLORS: Record<string, string> = {
  slate:   "border-slate-600/40 text-slate-300 bg-slate-800/40",
  rose:    "border-rose-500/40 text-rose-300 bg-rose-500/10 shadow-[0_0_15px_rgba(244,63,94,0.2)]",
  indigo:  "border-indigo-500/40 text-indigo-300 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]",
  cyan:    "border-cyan-400/50 text-cyan-200 bg-cyan-400/15 shadow-[0_0_20px_rgba(56,189,248,0.3)]",
  violet:  "border-violet-400/50 text-violet-200 bg-violet-400/15 shadow-[0_0_20px_rgba(139,92,246,0.3)]",
  mint:    "border-emerald-400/50 text-emerald-200 bg-emerald-400/15 shadow-[0_0_20px_rgba(16,185,129,0.3)]",
  crystal: "border-sky-400/50 text-sky-200 bg-sky-400/15 shadow-[0_0_20px_rgba(56,189,248,0.3)]",
  amber:   "border-amber-400/60 text-amber-200 bg-amber-400/20 shadow-[0_0_25px_rgba(251,191,36,0.35)]",
};

const CARD_GLOW: Record<string, string> = {
  slate:   "border-slate-800 bg-slate-950/80 shadow-[0_0_30px_rgba(0,0,0,0.8)]",
  rose:    "border-rose-900/50 bg-gradient-to-b from-slate-950 via-slate-950 to-rose-950/20 shadow-[0_0_35px_rgba(244,63,94,0.12)]",
  indigo:  "border-indigo-900/50 bg-gradient-to-b from-slate-950 via-slate-950 to-indigo-950/20 shadow-[0_0_35px_rgba(99,102,241,0.12)]",
  cyan:    "border-cyan-400/60 bg-gradient-to-br from-slate-950 via-slate-900/95 to-cyan-950/40 shadow-[0_0_50px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/30",
  violet:  "border-violet-400/60 bg-gradient-to-br from-slate-950 via-slate-900/95 to-violet-950/40 shadow-[0_0_50px_rgba(139,92,246,0.25)] ring-1 ring-violet-400/30",
  mint:    "border-emerald-400/60 bg-gradient-to-br from-slate-950 via-slate-900/95 to-emerald-950/40 shadow-[0_0_50px_rgba(16,185,129,0.25)] ring-1 ring-emerald-400/30",
  crystal: "border-sky-400/60 bg-gradient-to-br from-slate-950 via-slate-900/95 to-sky-950/40 shadow-[0_0_50px_rgba(56,189,248,0.25)] ring-1 ring-sky-400/30",
  amber:   "border-amber-400/70 bg-gradient-to-br from-slate-950 via-slate-900/95 to-amber-950/40 shadow-[0_0_60px_rgba(251,191,36,0.35)] ring-1 ring-amber-400/40",
};

const HEADLINE_COLORS: Record<string, string> = {
  slate:   "from-white to-slate-300",
  rose:    "from-rose-200 via-pink-300 to-rose-400",
  indigo:  "from-indigo-200 via-sky-300 to-indigo-400",
  cyan:    "from-cyan-100 via-sky-200 to-teal-300",
  violet:  "from-violet-100 via-fuchsia-200 to-indigo-300",
  mint:    "from-emerald-100 via-teal-200 to-emerald-300",
  crystal: "from-sky-100 via-cyan-200 to-blue-300",
  amber:   "from-amber-100 via-yellow-200 to-amber-400",
};

function getPrefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function CinematicHome() {
  const mainRef      = useRef<HTMLDivElement>(null);
  const progressRef  = useRef(0);
  const [stage,        setStage]        = useState("INTAKE");
  const [depthPercent, setDepthPercent] = useState(0);
  const [activeRail,   setActiveRail]   = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  // Hide the fixed canvas + HUD once the funnel section scrolls out of view
  const [canvasVisible, setCanvasVisible] = useState(true);

  useLenis(true);

  useEffect(() => {
    setReduceMotion(getPrefersReducedMotion());
  }, []);

  const updateHud = useCallback((progress: number) => {
    const pct = Math.round(progress * 100);
    setDepthPercent(pct);

    // Find active act index
    for (let i = SCROLL_ACTS.length - 1; i >= 0; i--) {
      if (progress >= SCROLL_ACTS[i]!.progress) {
        setStage(SCROLL_ACTS[i]!.shortLabel);
        setActiveRail(i);
        break;
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: mainRef.current,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: (self) => {
          progressRef.current = self.progress;
          updateHud(self.progress);
          // Hide canvas immediately when sequence reaches the end/CTA section
          if (self.progress >= 0.99) {
            setCanvasVisible(false);
          } else {
            setCanvasVisible(true);
          }
        },
      });
    }, mainRef);

    return () => ctx.revert();
  }, [updateHud]);

  // IntersectionObserver: hide canvas + HUD once the funnel <main> leaves viewport
  useEffect(() => {
    if (!mainRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        setCanvasVisible(entry?.isIntersecting ?? true);
      },
      { threshold: 0 },
    );
    obs.observe(mainRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <>
    <div
      ref={mainRef}
      className="relative"
      style={{ minHeight: `${ACTS.length * 100}vh` }}
    >
      {/* ── Fixed 3D canvas (behind everything) ─────────────────────────── */}
      <FunnelScene progressRef={progressRef} reduceMotion={reduceMotion} visible={canvasVisible} />

      {/* ── HUD — only while canvas is visible ──────────────────────────── */}
      {canvasVisible && (
        <HudGrid
          stage={stage}
          depthPercent={depthPercent}
          activeRailIndex={activeRail}
          items={HUD_STAGES}
        />
      )}

      {/* ── Scroll sections ──────────────────────────────────────────────── */}
      <div className="relative z-20 pointer-events-none">
        {ACTS.map((act, idx) => (
          <section
            key={act.id}
            id={`act-${act.id}`}
            className="flex min-h-screen items-center justify-center px-6"
          >
            <ActCard act={act} idx={idx} />
          </section>
        ))}
      </div>

      {/* Gradient overlay at top */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-10 h-32"
        style={{ background: "linear-gradient(to bottom, #020617 0%, transparent 100%)" }}
      />

      {/* ── Solid opaque seal at the funnel bottom ───────────────────────
           This sits at the very end of the <main> scroll area and covers
           the fixed canvas so no 3D bleed shows when post-funnel content
           scrolls into view. Position: sticky bottom so it's always the
           last thing visible before the normal-scroll sections begin.    */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 inset-x-0 h-64 z-30"
        style={{
          background:
            "linear-gradient(to bottom, transparent 0%, #070a18 55%, #070a18 100%)",
        }}
      />
    </div>

    {/* --- POST-FUNNEL SECTIONS (normal scroll, no fixed canvas) --- */}

    <div className="relative z-30 bg-[#070a18] text-white">

      {/* ── Workflow steps ──────────────────────────────────────────────── */}
      <section className="py-24 px-6" id="workflow">
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
      <section className="py-24 px-6 bg-[#07111f]" id="pilot">
        <div className="mx-auto max-w-5xl rounded-[36px] border border-white/10 bg-gradient-to-br from-[#151a38] to-[#2b0b3d] p-10 text-center shadow-2xl sm:p-14">
          <h2 className="text-4xl font-black sm:text-5xl">Join the pilot. Run your first governed campaign in 4 weeks.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-400">We are onboarding a small group of B2B service teams who want structured, approved outreach. Invite-only. No setup fees. No long-term commitment.</p>
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

// ─── Act card sub-component ──────────────────────────────────────────────────
function ActCard({ act, idx }: { act: typeof ACTS[number]; idx: number }) {
  const isLeft = idx % 2 === 0;
  const colorKey = "color" in act ? (act.color as string) : null;
  const tagCls = colorKey ? TAG_COLORS[colorKey] : "border-slate-500/30 text-slate-400 bg-slate-400/5";
  const glowCls = colorKey && CARD_GLOW[colorKey] ? CARD_GLOW[colorKey] : "border-white/10 bg-slate-950/75 shadow-2xl";
  const gradientClass = colorKey && HEADLINE_COLORS[colorKey] ? `bg-gradient-to-r ${HEADLINE_COLORS[colorKey]}` : "";

  return (
    <div
      className={`pointer-events-auto max-w-xl w-full ${isLeft ? "ml-0 mr-auto lg:ml-16" : "mr-0 ml-auto lg:mr-16"}`}
    >
      <div className={`rounded-[28px] border p-8 backdrop-blur-2xl transition-all duration-500 ${glowCls}`}>
        {/* Solution Badge (Layer 01 onwards) */}
        {"solutionBadge" in act && act.solutionBadge && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-white shadow-lg backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
            {act.solutionBadge}
          </div>
        )}

        {/* Category Pill (Act 0 & Pilot) */}
        {"categoryBadge" in act && act.categoryBadge && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3.5 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-cyan-300 shadow-[0_0_15px_rgba(56,189,248,0.25)]">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            {act.categoryBadge}
          </div>
        )}

        {/* Eyebrow */}
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-slate-400 font-semibold">
          {act.eyebrow}
        </p>

        {/* Tag pill */}
        {"tag" in act && act.tag && (
          <span
            className={`mb-4 inline-block rounded-full border px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider ${tagCls}`}
          >
            {act.tag}
          </span>
        )}

        {/* Headline */}
        <h2
          className={`mb-4 text-2xl font-black leading-tight tracking-tight sm:text-3xl ${
            gradientClass
              ? `text-transparent bg-clip-text ${gradientClass}`
              : "text-white"
          }`}
        >
          {act.headline}
        </h2>

        {/* Solves line */}
        {"solves" in act && act.solves && (
          <p className="mb-3 text-sm font-medium text-slate-300/90">
            <span className="text-slate-500 font-mono text-xs uppercase tracking-wider">Solves: </span>
            <span className="italic text-cyan-200/90">&ldquo;{act.solves}&rdquo;</span>
          </p>
        )}

        {/* Body */}
        <p className="text-base leading-relaxed text-slate-300 font-normal">{act.sub}</p>

        {/* Pillar data pills */}
        {getPillarForAct(act.id) && (
          <PillarPill pillar={getPillarForAct(act.id)!} colorKey={colorKey} />
        )}

        {/* Interactive Fast Scroll Link for Act 0 */}
        {act.id === "intake" && (
          <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-mono text-[10px] tracking-wider">Scroll down to explore 3D funnel</span>
            <a
              href="#workflow"
              className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-cyan-300 hover:text-white transition-colors underline underline-offset-4"
            >
              Skip to Overview ↓
            </a>
          </div>
        )}

        {/* Interactive Link for Revenue Output */}
        {act.id === "revenue" && (
          <div className="mt-6 pt-5 border-t border-amber-400/20 flex items-center justify-between text-xs">
            <span className="text-amber-200/80 font-mono text-[10px] tracking-wider">Ready to pilot with your team?</span>
            <a
              href="#pilot"
              className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-300 hover:text-white transition-colors underline underline-offset-4 font-bold"
            >
              Join Pilot Programme ↓
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function PillarPill({
  pillar,
  colorKey,
}: {
  pillar: typeof PILLARS[number];
  colorKey: string | null;
}) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {["Governed", "Traceable", pillar.tag].map((label) => (
        <span
          key={label}
          className="rounded-full bg-slate-900/80 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-slate-300 border border-slate-700/60 shadow-sm"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function getPillarForAct(id: string) {
  const map: Record<string, typeof PILLARS[number]> = {
    signal:   PILLARS[0]!,
    outreach: PILLARS[1]!,
    human:    PILLARS[2]!,
    edge:     PILLARS[3]!,
  };
  return map[id] ?? null;
}

