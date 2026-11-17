import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Briefcase, CheckCircle2, Server, ShieldCheck, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Technical B2B Service Workflows | CraftMyFunnel",
  description: "Explore focused account research, outreach preparation, and follow-up workflows for cybersecurity, managed IT and cloud, and AI, data and ERP service firms.",
  alternates: { canonical: "https://craftmyfunnel.live/use-cases" },
  openGraph: {
    title: "Technical B2B Service Workflows | CraftMyFunnel",
    description: "Focused workflows for technical service teams preparing outreach and tracking follow-up.",
  },
};

const COHORTS = [
  {
    slug: "cybersecurity",
    label: "Cybersecurity consultancies & MSSPs",
    description: "Prepare researched accounts, review outreach drafts and track the next step for security consulting and managed security opportunities.",
    icon: ShieldCheck,
  },
  {
    slug: "managed-it-cloud",
    label: "Managed IT & cloud service firms",
    description: "Bring managed IT and cloud prospecting into a shared workflow for researched leads, reviewed email drafts and follow-up tracking.",
    icon: Server,
  },
  {
    slug: "ai-data-erp",
    label: "AI, data & ERP consultancies",
    description: "Prepare account research, review service-specific email drafts and track consultative sales follow-up for AI, data and ERP projects.",
    icon: Briefcase,
  },
];

const REGIONS = [
  { slug: "europe", label: "Europe" },
  { slug: "uae", label: "UAE" },
  { slug: "canada", label: "Canada" },
];

const STEPS = [
  "Choose one service and a small group of researched accounts.",
  "Review the messages and the sender setup before anything is sent.",
  "Track replies and record the next step with your team.",
];

export default function UseCasesPage() {
  return (
    <div className="min-h-screen bg-[#020617] px-4 pb-24 pt-28 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <section aria-labelledby="use-cases-title">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan-300">
            <Sparkles className="h-4 w-4" aria-hidden="true" /> Use cases
          </p>
          <h1 id="use-cases-title" className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            Start with the service workflow your team needs to improve.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Focused workflows for technical service teams that prepare researched outreach and keep follow-up visible.
          </p>
        </section>

        <section className="mt-14 grid gap-5 md:grid-cols-3" aria-label="Service workflows">
          {COHORTS.map(({ slug, label, description, icon: Icon }) => (
            <Link
              key={slug}
              href={`/use-cases/${slug}`}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-7 transition hover:border-cyan-300/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
            >
              <Icon className="h-6 w-6 text-cyan-300" aria-hidden="true" />
              <h2 className="mt-5 text-lg font-bold">{label}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{description}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300">
                Explore the workflow <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </section>

        <section className="mt-16 rounded-3xl border border-slate-800 bg-slate-900/50 p-7 sm:p-10" aria-labelledby="regions-title">
          <h2 id="regions-title" className="text-2xl font-bold">Planning outreach in a specific region?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
            Each regional page lists the points to check before you start. Your team stays responsible for confirming recipient eligibility and local rules.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            {REGIONS.map(({ slug, label }) => (
              <Link
                key={slug}
                href={`/use-cases/regions/${slug}`}
                className="rounded-xl border border-slate-600 px-5 py-2.5 text-sm font-semibold hover:border-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
              >
                {label}
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-16" aria-labelledby="pilot-title">
          <h2 id="pilot-title" className="text-2xl font-bold">A focused pilot</h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step} className="flex gap-3 text-sm leading-7 text-slate-300">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-cyan-300" aria-hidden="true" />
                <span>{step}</span>
              </li>
            ))}
          </ul>
          <Link href="/contact" className="mt-8 inline-block rounded-xl bg-cyan-300 px-6 py-3 font-bold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">
            Discuss a 30-day pilot
          </Link>
        </section>
      </div>
    </div>
  );
}
