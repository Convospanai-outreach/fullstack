import Link from "next/link";
import type { ReactNode } from "react";
import { montserrat } from "../home/fonts";
import "./site.css";

/** Presidio-style building blocks shared by every marketing page. Server-safe. */

export type Cta = { label: string; href: string };
export type CardItem = { tag?: string; label?: string; title: string; body?: string; href?: string; linkText?: string };
type Tone = "light" | "white" | "beige" | "navy" | "fade" | "teal";

function Btn({ cta, kind }: { cta: Cta; kind: "yellow" | "navy" | "ghost" }) {
  const cls = `ph-btn ph-btn-${kind}${kind === "navy" ? " ph-inline" : ""}`;
  return cta.href.startsWith("http") || cta.href.startsWith("mailto:")
    ? <a className={cls} href={cta.href}>{cta.label}</a>
    : <Link className={cls} href={cta.href}>{cta.label}</Link>;
}

export function Page({ children }: { children: ReactNode }) {
  return <div className={`ph ${montserrat.variable}`}>{children}</div>;
}

export function PageHero({ eyebrow, title, lead, primary, secondary }: { eyebrow?: string | undefined; title: ReactNode; lead?: ReactNode | undefined; primary?: Cta | undefined; secondary?: Cta | undefined }) {
  return (
    <section className="ph-page-hero">
      <div className="ph-wrap">
        {eyebrow && <p className="ph-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {lead && <p className="ph-lead">{lead}</p>}
        {(primary || secondary) && (
          <div className="ph-actions">
            {primary && <Btn cta={primary} kind="yellow" />}
            {secondary && <Btn cta={secondary} kind="ghost" />}
          </div>
        )}
      </div>
    </section>
  );
}

export function Section({ tone = "light", id, eyebrow, title, lead, children, tight }: { tone?: Tone; id?: string; eyebrow?: string; title?: ReactNode; lead?: ReactNode; children?: ReactNode; tight?: boolean }) {
  return (
    <section id={id} className={`ph-section ph-${tone}${tight ? " ph-tight" : ""}`}>
      <div className="ph-wrap">
        {eyebrow && <p className="ph-eyebrow">{eyebrow}</p>}
        {title && <h2>{title}</h2>}
        {lead && <p className="ph-lead">{lead}</p>}
        {children}
      </div>
    </section>
  );
}

export function Cards({ items, cols = 3, dark }: { items: CardItem[]; cols?: 2 | 3 | 4; dark?: boolean }) {
  return (
    <div className={`ph-grid ph-grid-${cols}`}>
      {items.map((c) => (
        <article key={c.title} className={dark ? "ph-card-dark" : "ph-card"}>
          {c.tag && <span className="ph-tag">{c.tag}</span>}
          {c.label && <p className="ph-label">{c.label}</p>}
          <h3>{c.title}</h3>
          {c.body && <p>{c.body}</p>}
          {c.href && <Link href={c.href}>{c.linkText ?? "Learn more"}</Link>}
        </article>
      ))}
    </div>
  );
}

export function Steps({ items }: { items: { n?: string; label?: string; title: string; body?: string }[] }) {
  return (
    <div className="ph-steps">
      {items.map((s, i) => (
        <article key={s.title} className="ph-step">
          <span className="ph-step-n">{s.n ?? String(i + 1).padStart(2, "0")}</span>
          <div>{s.label && <p className="ph-label">{s.label}</p>}<h3>{s.title}</h3>{s.body && <p style={{ color: "var(--ph-muted)", marginTop: 6 }}>{s.body}</p>}</div>
        </article>
      ))}
    </div>
  );
}

export function Checklist({ items, negative }: { items: string[]; negative?: boolean }) {
  return <ul className={`ph-list${negative ? " no" : ""}`}>{items.map((t) => <li key={t}>{t}</li>)}</ul>;
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="ph-faq">
      {items.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
    </div>
  );
}

export function Stats({ items, source }: { items: { value: string; text: string }[]; source?: string }) {
  return (
    <>
      <div className="ph-stats">{items.map((s) => <div key={s.value + s.text} className="ph-stat"><strong>{s.value}</strong><p>{s.text}</p></div>)}</div>
      {source && <p className="ph-source">{source}</p>}
    </>
  );
}

export function CtaBand({ title, lead, primary, secondary }: { title: ReactNode; lead?: ReactNode; primary: Cta; secondary?: Cta }) {
  return (
    <section className="ph-cta-band">
      <div className="ph-wrap">
        <h2>{title}</h2>
        {lead && <p className="ph-lead">{lead}</p>}
        <div className="ph-actions"><Btn cta={primary} kind="yellow" />{secondary && <Btn cta={secondary} kind="ghost" />}</div>
      </div>
    </section>
  );
}

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

/** Text-heavy pages (legal, policies, support): navy title band + readable prose column. */
export function ProsePage({ eyebrow, title, updated, children }: { eyebrow?: string; title: ReactNode; updated?: string; children: ReactNode }) {
  return (
    <Page>
      <PageHero eyebrow={eyebrow} title={title} lead={updated ? `Last updated: ${updated}` : undefined} />
      <section className="ph-section ph-white"><div className="ph-wrap"><div className="ph-prose">{children}</div></div></section>
    </Page>
  );
}
