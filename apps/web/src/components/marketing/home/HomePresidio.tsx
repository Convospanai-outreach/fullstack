"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { InviteRequestForm } from "../InviteRequestForm";
import { CHANNELS, HOME, type SignupPath } from "./homeContent";
import { montserrat } from "./fonts";
import { cleanImagePath, STEP_IMAGE } from "@/lib/siteImages";
import { INDUSTRIES, MARKET_LABEL } from "@/lib/marketing/industries";
import "../site/site.css";

/** Drop a photo in /public (e.g. "/images/home-hero.jpg") to replace the gradient. */
const HERO_IMAGE: string | null = null;

/** Harvard Business Review, "The Short Life of Online Sales Leads" (Oldroyd, McElheran & Elkington, 2011). */
const STATS = [
  { value: "7x", text: "more likely to qualify a lead when you reply within an hour instead of waiting one more." },
  { value: "60x", text: "more likely to qualify within an hour than after a full day." },
  { value: "42 hrs", text: "average first response time among companies that replied at all." },
];
const STATS_SOURCE = "Source: Harvard Business Review, “The Short Life of Online Sales Leads”, 2011.";

/** Fill with real customer stories only. Section stays hidden while empty. */
const PROOF: { client: string; summary: string; href: string }[] = [];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="ph-eyebrow">{children}</p>;
}

/**
 * One connected story told across the six steps, so the images read as a single day in the life of a small team:
 * Maya (founder, sells the firm's services) and Dev (her colleague who reviews what goes out), and one fictional
 * prospect, Priya. Briefs for whoever makes the images: real-looking people at work, warm daylight, no logos, no
 * readable screen text, no real people or brands. Show the people and the moment, not a dashboard.
 */
const STORY = [
  { scene: "Maya's Monday morning", brief: "Maya at her desk with coffee, a laptop and a few sticky notes. An enquiry has just come in and she is reading it, calm for once instead of hunting through tabs." },
  { scene: "A first draft, still hers to change", brief: "Over Maya's shoulder: she reads a short drafted message to Priya and changes one line with her pen. The draft is a starting point; she is the author." },
  { scene: "Everything about Priya in one place", brief: "Maya and Dev side by side at one screen, both looking at the same contact, one talking, one pointing. A phone beside them for the call hand-off." },
  { scene: "The reply lands", brief: "Maya's phone lights up on the desk. She glances at it and smiles. Priya has answered, and she knows what it means and what to do next." },
  { scene: "Dev checks before it goes out", brief: "Dev at a meeting table with a notebook, reviewing what is queued. He pauses one message to ask Maya a question: a second pair of eyes, not a bottleneck." },
  { scene: "Maya meets Priya", brief: "Maya and Priya meet for the first time, in person or on a video call, both mid-conversation and relaxed. The point of the six steps: a real conversation with a real person." },
] as const;

function HowWeHelp() {
  const steps = HOME.workflow.steps;
  const [tab, setTab] = useState(0);
  const step = steps[tab]!;
  const chapter = STORY[tab]!;
  const desktop = cleanImagePath(step.image.desktop);
  const mobile = desktop ? cleanImagePath(step.image.mobile) : "";
  return (
    <section className="ph-section ph-light" id="how" aria-labelledby="how-title">
      <div className="ph-wrap">
        <Eyebrow>{HOME.workflow.kicker}</Eyebrow>
        <h2 id="how-title">{HOME.workflow.heading}</h2>
        <p className="ph-lead">{HOME.workflow.intro}</p>
        <div className="ph-tabs" role="tablist" aria-label="Workflow steps">
          {steps.map((s, i) => (
            <button key={s.node} type="button" role="tab" id={`ph-tab-${i}`} aria-selected={tab === i} aria-controls="ph-tabpanel" className={tab === i ? "active" : ""} onClick={() => setTab(i)}>
              {s.node}
            </button>
          ))}
        </div>
        <div className="ph-tabpanel" id="ph-tabpanel" role="tabpanel" aria-labelledby={`ph-tab-${tab}`}>
          <div className="ph-tp-copy">
            <p className="ph-label">{step.meta}</p>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </div>
          {/* Image for this step: the one uploaded in the CMS, else a placeholder carrying the scene brief. */}
          {desktop ? (
            <figure className="ph-imgslot ph-imgslot-filled">
              <picture>
                {mobile && <source media="(max-width: 1024px)" srcSet={mobile} width={STEP_IMAGE.mobile.width} height={STEP_IMAGE.mobile.height} />}
                <img src={desktop} alt={step.image.alt} width={STEP_IMAGE.desktop.width} height={STEP_IMAGE.desktop.height} loading="lazy" decoding="async" />
              </picture>
            </figure>
          ) : (
            <figure className="ph-imgslot" role="img" aria-label={`Image placeholder, chapter ${tab + 1} of ${steps.length}: ${chapter.scene}. ${chapter.brief}`}>
              <figcaption>
                <span className="ph-label">Image placeholder · Chapter {tab + 1} of {steps.length}</span>
                <strong>{chapter.scene}</strong>
                <span>{chapter.brief}</span>
              </figcaption>
            </figure>
          )}
          <div className="ph-tp-more">
            <ul>
              {step.bullets.map((b) => <li key={b}>{b}</li>)}
            </ul>
            <a className="ph-btn ph-btn-yellow" href="#start">Get started</a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Closing() {
  const router = useRouter();
  const paths = { individual: HOME.signup.individual, team: HOME.signup.team };
  const [path, setPath] = useState<SignupPath>("individual");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [pilotEmail, setPilotEmail] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL.test(value)) {
      setError("Enter a valid email address to continue.");
      document.getElementById("ph-email")?.focus();
      return;
    }
    setError("");
    if (path === "team") { setPilotEmail(value); return; }
    router.push(`/signup?email=${encodeURIComponent(value)}`);
  }

  return (
    <section className="ph-section ph-navy ph-closing" id="start" aria-labelledby="start-title">
      <div className="ph-wrap ph-closing-grid">
        <div>
          <Eyebrow>{HOME.signup.eyebrow}</Eyebrow>
          <h2 id="start-title">{HOME.signup.title} {HOME.signup.accent}</h2>
          <p className="ph-lead">{HOME.signup.body}</p>
        </div>
        <form className="ph-form" onSubmit={submit} noValidate>
          <h3>{HOME.signup.formTitle}</h3>
          <div className="ph-choice" role="group" aria-label="Account type">
            {(Object.keys(paths) as SignupPath[]).map((key) => (
              <button key={key} type="button" aria-pressed={path === key} className={path === key ? "active" : ""} onClick={() => { setPath(key); setPilotEmail(null); setError(""); }}>
                {paths[key].label}
              </button>
            ))}
          </div>
          <p className="ph-note">{paths[path].hint}</p>
          <label htmlFor="ph-email">Email address</label>
          <div className="ph-inputrow">
            <input id="ph-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required aria-invalid={error ? true : undefined} aria-describedby="ph-email-status" />
            <button className="ph-btn ph-btn-yellow" type="submit">{paths[path].cta}</button>
          </div>
          <p id="ph-email-status" className={`ph-note${error ? " ph-error" : ""}`} role="status" aria-live="polite">
            {error || (path === "team" ? "Teams join through a short pilot request, reviewed by hand." : "You will create your account on the next screen.")}
          </p>
        </form>
      </div>
      {pilotEmail && (
        <div className="ph-wrap ph-pilot">
          <h3>Tell us about your team</h3>
          <InviteRequestForm showOutcomePreview={false} initialEmail={pilotEmail} />
        </div>
      )}
    </section>
  );
}

/** First CMS testimonial (content/testimonials). Section stays hidden while there are none. */
type Quote = { quote: string; name: string; role: string; company: string };

export default function HomePresidio({ testimonial = null }: { testimonial?: Quote | null }) {
  const [hero, problem, guide] = HOME.story;
  return (
    <div className={`ph ${montserrat.variable}`}>
      <section className="ph-hero" aria-labelledby="hero-title">
        {HERO_IMAGE && <img className="ph-hero-img" src={HERO_IMAGE} alt="" />}
        <div className="ph-wrap ph-hero-inner">
          <h1 id="hero-title">{hero!.title} {hero!.accent}</h1>
          <p>{hero!.body}</p>
          <a className="ph-btn ph-btn-yellow" href="#how">See how it works</a>
        </div>
      </section>

      <section className="ph-section ph-fade" aria-labelledby="problem-title">
        <div className="ph-wrap">
          <h2 id="problem-title">{problem!.title} {problem!.accent}</h2>
          <p className="ph-lead">{problem!.body}</p>
          <div className="ph-stats">
            {STATS.map((s) => (
              <div key={s.value} className="ph-stat"><strong>{s.value}</strong><p>{s.text}</p></div>
            ))}
          </div>
          <p className="ph-source">{STATS_SOURCE}</p>
        </div>
      </section>

      <section className="ph-section ph-light" aria-labelledby="plan-title">
        <div className="ph-wrap">
          <Eyebrow>{guide!.eyebrow.replace(/^\d+\s*\/\s*/, "")}</Eyebrow>
          <h2 id="plan-title">{guide!.title} {guide!.accent}</h2>
          <p className="ph-lead">{guide!.body}</p>
          <div className="ph-steps">
            {HOME.plan.map((p) => (
              <article key={p.n} className="ph-step">
                <span className="ph-step-n">{p.n}</span>
                <div><p className="ph-label">{p.title}</p><h3>{p.body}</h3></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {testimonial && (
        <section className="ph-section ph-light ph-quote">
          <div className="ph-wrap">
            <blockquote>“{testimonial.quote}”</blockquote>
            <p className="ph-label">{[testimonial.name, testimonial.role, testimonial.company].filter(Boolean).join(", ")}</p>
          </div>
        </section>
      )}

      <HowWeHelp />

      {PROOF.length > 0 && (
        <section className="ph-section ph-navy" aria-labelledby="proof-title">
          <div className="ph-wrap">
            <h2 id="proof-title">Proof of impact</h2>
            <div className="ph-grid ph-grid-3">
              {PROOF.map((p) => (
                <article key={p.client} className="ph-card-dark"><p className="ph-label">{p.client}</p><p>{p.summary}</p><Link href={p.href}>Read story</Link></article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="ph-section ph-navy" aria-labelledby="ind-title">
        <div className="ph-wrap">
          <p className="ph-eyebrow">Industries</p>
          <h2 id="ind-title">Every industry has a buying window. Be there when it opens.</h2>
          <p className="ph-lead">NIS2, the SAP 2027 deadline, India's GCC boom and DPDP are pushing buyers to act now.</p>
          <div className="ph-grid ph-grid-3">
            {INDUSTRIES.filter((c) => !c.more).map((c) => (
              <article key={c.slug} className="ph-card-dark">
                <p className="ph-label">{MARKET_LABEL[c.market]}</p>
                <h3>{c.name}</h3>
                <p>{c.whyNow.title}</p>
                <Link href={`/industries/${c.slug}`}>Learn more</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ph-section ph-beige" aria-labelledby="ch-title">
        <div className="ph-wrap">
          <h2 id="ch-title">{HOME.channels.intro.title} {HOME.channels.intro.accent}</h2>
          <p className="ph-lead">{HOME.channels.intro.body}</p>
          <ul className="ph-chips">{CHANNELS.map((c) => <li key={c.id}>{c.label}</li>)}</ul>
          <div className="ph-grid ph-grid-4">
            {HOME.channels.journey.map((s) => (
              <article key={s.tag} className="ph-card"><p className="ph-label">{s.tag}</p><h3>{s.title}</h3><p>{s.body}</p></article>
            ))}
          </div>
          <p className="ph-source">{HOME.channels.note}</p>
        </div>
      </section>

      <section className="ph-section ph-beige ph-tight" aria-labelledby="crm-title">
        <div className="ph-wrap">
          <Eyebrow>{HOME.crm.intro.kicker}</Eyebrow>
          <h2 id="crm-title">{HOME.crm.intro.title} {HOME.crm.intro.accent}</h2>
          <p className="ph-lead">{HOME.crm.intro.body}</p>
          <div className="ph-grid ph-grid-2">
            {HOME.crm.cards.map((c) => (
              <article key={c.tag} className="ph-card"><p className="ph-label">{c.tag}</p><h3>{c.title}</h3><p>{c.body}</p></article>
            ))}
          </div>
          <a className="ph-btn ph-btn-navy" href="#start">Talk to our team</a>
        </div>
      </section>

      <section className="ph-section ph-teal" aria-labelledby="turn-title">
        <div className="ph-wrap">
          <h2 id="turn-title">{HOME.closing.title} {HOME.closing.accent}</h2>
          <p className="ph-lead">{HOME.closing.bridge} {HOME.closing.bridgeBold}</p>
        </div>
      </section>

      <Closing />
    </div>
  );
}
