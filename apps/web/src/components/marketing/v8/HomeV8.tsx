"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import { OpportunityEngineSvg } from "./OpportunityEngineSvg";
import { GovernedWorkflow } from "./GovernedWorkflow";
import { FinalSignup } from "./FinalSignup";
import { CHANNELS, HOME, STORY_NAMES, type AudienceKey } from "./homeV8Content";
import "./v8.css";

const display = Space_Grotesk({ subsets: ["latin"], display: "swap", variable: "--v8-display" });
const body = DM_Sans({ subsets: ["latin"], display: "swap", variable: "--v8-body" });

const STORY_PANELS = 7;

function ChannelIcon({ id }: { id: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><use href={`#v8-icon-${id}`} /></svg>;
}

const PANEL_IDS = ["begin", "problem", "guide", "plan", "action", "stakes", "success"] as const;

const DESKTOP = "(min-width: 761px)";

/**
 * On desktop the story cards are pinned in place and swap as you scroll, so the step comes from
 * scroll progress through the story (1 = one card height scrolled). Returns null on mobile,
 * where cards scroll past normally.
 */
function storyProgress(): number | null {
  if (!window.matchMedia(DESKTOP).matches) return null;
  const story = document.querySelector(".arc-story");
  const first = document.getElementById(PANEL_IDS[0]);
  if (!story || !first) return null;
  const nav = parseFloat(getComputedStyle(story.closest(".v8") ?? document.body).getPropertyValue("--v8-nav")) || 66;
  return (nav - story.getBoundingClientRect().top) / first.offsetHeight;
}

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
      let best = 0;
      const progress = storyProgress();
      if (progress !== null) {
        best = Math.min(STORY_PANELS - 1, Math.max(0, Math.floor(progress + 0.45)));
      } else {
        const center = window.innerHeight * 0.53;
        let dist = Infinity;
        PANEL_IDS.forEach((id, i) => {
          const el = document.getElementById(id);
          if (!el) return;
          const r = el.getBoundingClientRect();
          const d = Math.abs((r.top + r.bottom) / 2 - center);
          if (d < dist) { dist = d; best = i; }
        });
      }
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
    const behavior = reduce ? "auto" : "smooth";
    const progress = storyProgress();
    const first = document.getElementById(PANEL_IDS[0]);
    if (progress === null || !first) {
      document.getElementById(PANEL_IDS[i]!)?.scrollIntoView({ behavior, block: "center" });
      return;
    }
    window.scrollTo({ top: window.scrollY + (i - progress) * first.offsetHeight, behavior });
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
            {HOME.story.map((p, i) => {
              const id = PANEL_IDS[i]!;
              const Heading = i === 0 ? "h1" : "h2";
              return (
                <section key={id} className={`panel ${i % 2 === 0 ? "align-left" : "align-right"}${active === i ? " active" : ""}`} id={id} aria-labelledby={`${id}-title`}>
                  <div className="copy">
                    <div className="eyebrow">{p.eyebrow}</div>
                    <Heading id={`${id}-title`}>{p.title} <span className="highlight">{p.accent}</span></Heading>
                    <p>{p.body}</p>
                    {i === 3 && (
                      <div className="planlist">
                        {HOME.plan.map((item) => (
                          <div className="planitem" key={item.n}><b>{item.n}</b><div>{item.title}<small>{item.body}</small></div></div>
                        ))}
                      </div>
                    )}
                    <p className="punch"><strong>{p.punch}</strong></p>
                    {(i === 1 || i === 2) && <span className="tiny-tag">{p.note}</span>}
                    {(i === 0 || i === 4) && (
                      <div className="actions">
                        <button type="button" className="primary" onClick={openSignup}>{p.primary}</button>
                        {i === 0 && <a className="secondary" href="#problem" onClick={(e) => { e.preventDefault(); goTo(1); }}>{p.secondary}</a>}
                      </div>
                    )}
                    {i === 0 && <div className="hint"><span className="scroll-icon" aria-hidden="true" />{p.note}</div>}
                    {i === 4 && <div className="phase">{p.note}</div>}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <section className="final-context" aria-label="Closing line">
          <div className="context-heading">
            <div className="eyebrow">{HOME.closing.eyebrow}</div>
            <h2>{HOME.closing.title} <span className="highlight">{HOME.closing.accent}</span></h2>
          </div>
          <p className="context-bridge">{HOME.closing.bridge} <strong>{HOME.closing.bridgeBold}</strong></p>
        </section>

        <section className="addons" id="audiences" aria-labelledby="audience-heading">
          <div className="addon-kicker">{HOME.audiences.intro.kicker}</div>
          <div className="addon-intro">
            <h2 id="audience-heading">{HOME.audiences.intro.title}<br /><span className="highlight">{HOME.audiences.intro.accent}</span></h2>
            <p>{HOME.audiences.intro.body}</p>
          </div>
          <div className="audience-switch" role="group" aria-label="Choose an audience">
            {(["solo", "teams"] as AudienceKey[]).map((key) => (
              <button key={key} type="button" className={`aud-tab${audience === key ? " active" : ""}`} aria-pressed={audience === key} onClick={() => setAudience(key)}>
                {HOME.audiences[key].label}
              </button>
            ))}
          </div>
          <div className="audience-cards" aria-live="polite">
            {HOME.audiences[audience].cards.map((card) => (
              <article className="aud-card" key={card.tag}><span>{card.tag}</span><h3>{card.title}</h3><p>{card.body}</p></article>
            ))}
          </div>
        </section>

        <section className="addons funnel-journey" id="channels" aria-labelledby="channels-heading">
          <div className="addon-kicker">{HOME.channels.intro.kicker}</div>
          <div className="addon-intro">
            <h2 id="channels-heading">{HOME.channels.intro.title}<br /><span className="highlight">{HOME.channels.intro.accent}</span></h2>
            <p>{HOME.channels.intro.body}</p>
          </div>
          <div className="channel-bar" role="list" aria-label="Channel choices">
            {CHANNELS.map((c) => <span role="listitem" key={c.id}><ChannelIcon id={c.id} />{c.label}</span>)}
          </div>
          <div className="journey-steps" role="list" aria-label="Illustrative funnel journey">
            {HOME.channels.journey.map((s) => (
              <article role="listitem" key={s.tag}><span>{s.tag}</span><h3>{s.title}</h3><p>{s.body}</p></article>
            ))}
          </div>
          <p className="capability-note">{HOME.channels.note}</p>
        </section>

        <section className="addons crm-addon" id="crm" aria-labelledby="crm-heading">
          <div className="addon-kicker">{HOME.crm.intro.kicker}</div>
          <div className="addon-intro">
            <h2 id="crm-heading">{HOME.crm.intro.title}<br /><span className="highlight">{HOME.crm.intro.accent}</span></h2>
            <p>{HOME.crm.intro.body}</p>
          </div>
          <div className="crm-grid">
            {HOME.crm.cards.map((c, i) => (
              <article key={c.tag} className={`crm-card${i === 1 ? " emphasis" : ""}`}><span>{c.tag}</span><h3>{c.title}</h3><p>{c.body}</p></article>
            ))}
          </div>
          <GovernedWorkflow />
        </section>

        <FinalSignup />
      </main>
    </div>
  );
}
