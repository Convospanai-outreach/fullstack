"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import { OpportunityEngineSvg } from "./OpportunityEngineSvg";
import { GovernedWorkflow } from "./GovernedWorkflow";
import { FinalSignup } from "./FinalSignup";
import { AUDIENCES, CHANNELS, JOURNEY, PLAN_ITEMS, STORY_NAMES, type AudienceKey } from "./homeV8Content";
import "./v8.css";

const display = Space_Grotesk({ subsets: ["latin"], display: "swap", variable: "--v8-display" });
const body = DM_Sans({ subsets: ["latin"], display: "swap", variable: "--v8-body" });

const STORY_PANELS = 7;

function ChannelIcon({ id }: { id: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><use href={`#v8-icon-${id}`} /></svg>;
}

const PANEL_IDS = ["begin", "problem", "guide", "plan", "action", "stakes", "success"] as const;

export default function HomeV8() {
  const rootRef = useRef<HTMLDivElement>(null);
  const arcRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [live, setLive] = useState(true);
  const [chaptersVisible, setChaptersVisible] = useState(true);
  const [audience, setAudience] = useState<AudienceKey>("solo");

  // Scroll state: one rAF-throttled pass that picks the panel nearest the viewport centre.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const center = window.innerHeight * 0.53;
      let best = 0, dist = Infinity;
      PANEL_IDS.forEach((id, i) => {
        const el = document.getElementById(id);
        if (!el) return;
        const r = el.getBoundingClientRect();
        const d = Math.abs((r.top + r.bottom) / 2 - center);
        if (d < dist) { dist = d; best = i; }
      });
      setActive((prev) => (prev === best ? prev : best));
      const doc = document.documentElement;
      if (progressRef.current) {
        progressRef.current.style.width = `${Math.min(100, (100 * window.scrollY) / Math.max(1, doc.scrollHeight - window.innerHeight))}%`;
      }
      const ctx = arcRef.current?.getBoundingClientRect();
      setChaptersVisible(!ctx || ctx.bottom > window.innerHeight * 0.4);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Pause the engine's animations whenever the sticky scene is off screen.
  useEffect(() => {
    const arc = arcRef.current;
    if (!arc || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setLive(!!entry?.isIntersecting), { rootMargin: "100px" });
    io.observe(arc);
    return () => io.disconnect();
  }, []);

  const goTo = useCallback((i: number) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(PANEL_IDS[i]!)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  }, []);

  const openSignup = useCallback(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("start")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    window.setTimeout(() => document.getElementById("v8-signup-email")?.focus({ preventScroll: true }), reduce ? 0 : 650);
  }, []);

  return (
    <div ref={rootRef} className={`v8 ${display.variable} ${body.variable}`} data-active={active} data-live={live ? "1" : "0"}>
      <div className="background" aria-hidden="true" />
      <div className="scroll-progress" aria-hidden="true"><div ref={progressRef} /></div>
      {chaptersVisible && (
        <nav className="counter" aria-label="Story chapters">
          {STORY_NAMES.map((name, i) => (
            <button key={name} type="button" className={`dot${active === i ? " active" : ""}`} aria-label={`Jump to ${name}`} aria-current={active === i ? "step" : undefined} onClick={() => goTo(i)}>
              <span>{name}</span><i />
            </button>
          ))}
        </nav>
      )}

      <main className="site">
        <div className="transformation-arc" ref={arcRef}>
          <div className="vertical-track track-left" aria-hidden="true" />
          <div className="vertical-track track-right" aria-hidden="true" />
          <div className="scene" role="img" aria-label="Animated hourglass opportunity engine. It starts dormant and becomes a working mechanical engine as you scroll.">
            <OpportunityEngineSvg />
          </div>
          <div className="story arc-story">
            <section className={`panel align-left${active === 0 ? " active" : ""}`} id="begin" aria-labelledby="begin-title">
              <div className="copy">
                <div className="eyebrow">01 / THE OPENING</div>
                <h1 id="begin-title">Someone is ready to buy. <span className="highlight">Are you in the picture?</span></h1>
                <p>A scroll. A search. A referral. Your next customer is already somewhere in the crowd.</p>
                <p className="punch"><strong>Make the shortlist. Not the sidelines.</strong></p>
                <div className="actions">
                  <button type="button" className="primary" onClick={openSignup}>Build my funnel ↗</button>
                  <a className="secondary" href="#problem">Follow the signal ↓</a>
                </div>
                <div className="hint"><span className="scroll-icon" aria-hidden="true" />Scroll to activate the engine</div>
              </div>
            </section>
            <section className={`panel align-right${active === 1 ? " active" : ""}`} id="problem" aria-labelledby="problem-title">
              <div className="copy">
                <div className="eyebrow">02 / THE BREAK</div>
                <h2 id="problem-title">The lead came in. <span className="highlight">Then went missing.</span></h2>
                <p>An Instagram DM here. A LinkedIn reply there. A form filled. A WhatsApp unread.</p>
                <p className="punch"><strong>Plenty of interest. Precious little follow-through.</strong></p>
                <span className="tiny-tag">The problem isn&rsquo;t traffic. It&rsquo;s the handoff.</span>
              </div>
            </section>
            <section className={`panel align-left${active === 2 ? " active" : ""}`} id="guide" aria-labelledby="guide-title">
              <div className="copy">
                <div className="eyebrow">03 / THE GUIDE</div>
                <h2 id="guide-title">A hundred touchpoints. <span className="highlight">One firm grip.</span></h2>
                <p>Bring social, forms, email and outreach into one organised journey. Let AI assist. Keep people in charge.</p>
                <p className="punch"><strong>Connected channels. Clear ownership. No lead left to guesswork.</strong></p>
                <span className="tiny-tag">Automation with brakes, not blinders.</span>
              </div>
            </section>
            <section className={`panel align-right${active === 3 ? " active" : ""}`} id="plan" aria-labelledby="plan-title">
              <div className="copy">
                <div className="eyebrow">04 / THE PLAN</div>
                <h2 id="plan-title">Catch the signal. <span className="highlight">Keep the momentum.</span></h2>
                <p>Three moves. One moving pipeline.</p>
                <div className="planlist">
                  {PLAN_ITEMS.map((item) => (
                    <div className="planitem" key={item.n}><b>{item.n}</b><div>{item.title}<small>{item.body}</small></div></div>
                  ))}
                </div>
                <p className="punch"><strong>No channel should be a dead end.</strong></p>
              </div>
            </section>
            <section className={`panel align-left${active === 4 ? " active" : ""}`} id="action" aria-labelledby="action-title">
              <div className="copy">
                <div className="eyebrow">05 / THE DECISION</div>
                <h2 id="action-title">Your audience showed interest. <span className="highlight">Make your move.</span></h2>
                <p>One campaign. One landing page. One clear next step.</p>
                <p className="punch"><strong>Turn the click into a conversation.</strong></p>
                <div className="actions"><button type="button" className="primary" onClick={openSignup}>Start my funnel ↗</button></div>
                <div className="phase">Start with the people you actually want to reach.</div>
              </div>
            </section>
            <section className={`panel align-right${active === 5 ? " active" : ""}`} id="stakes" aria-labelledby="stakes-title">
              <div className="copy">
                <div className="eyebrow">06 / WHAT SLIPS AWAY</div>
                <h2 id="stakes-title">An unread message <span className="highlight">doesn&rsquo;t send a warning.</span></h2>
                <p>The DM cools. The form goes stale. The buyer finds someone faster.</p>
                <p className="punch"><strong>Silence isn&rsquo;t a sales strategy.</strong></p>
              </div>
            </section>
            <section className={`panel align-left${active === 6 ? " active" : ""}`} id="success" aria-labelledby="success-title">
              <div className="copy">
                <div className="eyebrow">07 / WHAT MOVES FORWARD</div>
                <h2 id="success-title">From &ldquo;seen&rdquo; <span className="highlight">to &ldquo;let&rsquo;s talk.&rdquo;</span></h2>
                <p>A captured enquiry. A relevant reply. A meeting with a name and a next step.</p>
                <p className="punch"><strong>Less chasing ghosts. More genuine conversations.</strong></p>
              </div>
            </section>
          </div>
        </div>

        <section className="final-context" aria-label="Closing line">
          <div className="context-heading">
            <div className="eyebrow">THE TURNING POINT</div>
            <h2>Same attention. <span className="highlight">Different ending.</span></h2>
          </div>
          <p className="context-bridge">Interest has a short shelf life. <strong>Give it somewhere to go.</strong></p>
        </section>

        <section className="addons" id="audiences" aria-labelledby="audience-heading">
          <div className="addon-kicker">BEYOND THE FIRST CLICK / THE ADDENDUM</div>
          <div className="addon-intro">
            <h2 id="audience-heading">Different hustles.<br /><span className="highlight">Same missed chances.</span></h2>
            <p>From a one-person practice to a sales floor, a better follow-up changes the story.</p>
          </div>
          <div className="audience-switch" role="group" aria-label="Choose an audience">
            {(Object.keys(AUDIENCES) as AudienceKey[]).map((key) => (
              <button key={key} type="button" className={`aud-tab${audience === key ? " active" : ""}`} aria-pressed={audience === key} onClick={() => setAudience(key)}>
                {AUDIENCES[key].label}
              </button>
            ))}
          </div>
          <div className="audience-cards" aria-live="polite">
            {AUDIENCES[audience].cards.map((card) => (
              <article className="aud-card" key={card.tag}><span>{card.tag}</span><h3>{card.title}</h3><p>{card.body}</p></article>
            ))}
          </div>
        </section>

        <section className="addons funnel-journey" id="channels" aria-labelledby="channels-heading">
          <div className="addon-kicker">ONE JOURNEY / MANY ENTRY POINTS</div>
          <div className="addon-intro">
            <h2 id="channels-heading">A click is a beginning.<br /><span className="highlight">Not a business result.</span></h2>
            <p>Put your channels to work together. From first interest to a clear next step.</p>
          </div>
          <div className="channel-bar" role="list" aria-label="Channel choices">
            {CHANNELS.map((c) => <span role="listitem" key={c.id}><ChannelIcon id={c.id} />{c.label}</span>)}
          </div>
          <div className="journey-steps" role="list" aria-label="Illustrative funnel journey">
            {JOURNEY.map((s) => (
              <article role="listitem" key={s.tag}><span>{s.tag}</span><h3>{s.title}</h3><p>{s.body}</p></article>
            ))}
          </div>
          <p className="capability-note">Channels shown are the intended product journey. Availability, permissions, calling consent and supported automation depend on the live integration and account configuration.</p>
        </section>

        <section className="addons crm-addon" id="crm" aria-labelledby="crm-heading">
          <div className="addon-kicker">FOR TEAMS WITH A CRM</div>
          <div className="addon-intro">
            <h2 id="crm-heading">Your CRM records the past.<br /><span className="highlight">Who owns the next move?</span></h2>
            <p>Keep the system of record. Make follow-through the system of action.</p>
          </div>
          <div className="crm-grid">
            <article className="crm-card"><span>YOUR CRM</span><h3>What happened.</h3><p>Contacts, activities, deal history and pipeline stages.</p></article>
            <article className="crm-card emphasis"><span>CRAFTMYFUNNEL</span><h3>What happens next.</h3><p>Relevant signals, coordinated outreach, approvals and follow-up.</p></article>
          </div>
          <GovernedWorkflow />
        </section>

        <FinalSignup />
      </main>
    </div>
  );
}
