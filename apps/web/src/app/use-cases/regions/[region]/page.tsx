import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const REGIONS = [
  {
    slug: "europe",
    name: "Europe",
    title: "A focused workflow for European technical service teams.",
    description: "Organize researched accounts, prepare outreach drafts, and track follow-up for cybersecurity, managed IT and cloud, and AI, data and ERP services.",
    scenarios: ["A security consultancy preparing outreach around one assessment service.", "An MSP coordinating follow-up while delivery work continues.", "A data consultancy carrying account context into a project conversation."],
    guidance: "Electronic marketing requirements vary by recipient country. Review the relevant local rules, the purpose of the message, recipient eligibility, and transparency information before sending. The UK is not an EU Member State and needs its own assessment.",
  },
  {
    slug: "uae",
    name: "UAE",
    title: "A focused workflow for UAE technical service teams.",
    description: "Keep researched account context, outreach drafts and follow-up visible for UAE cybersecurity, cloud and ERP service opportunities.",
    scenarios: ["A managed-security provider organizing account research for one service.", "A cloud consultancy preparing a review-ready migration-services message.", "An ERP partner keeping a commercial handoff visible after an initial conversation."],
    guidance: "Assess the applicable UAE federal requirements and, where relevant, the distinct DIFC or ADGM position before sending. Publicly listed business contact details are not a blanket permission for marketing outreach.",
  },
  {
    slug: "canada",
    name: "Canada",
    title: "A focused workflow for Canadian technical service teams.",
    description: "Use a shared workflow to prepare account-specific outreach and track next steps for cybersecurity, managed IT and cloud, and AI, data and ERP services. Public prices are shown in USD.",
    scenarios: ["A cloud services team reviewing a small account set for one managed offer.", "A cybersecurity consultancy preparing relevant account context before outreach.", "A data implementation firm tracking ownership after a discovery conversation."],
    guidance: "Complete a CASL assessment before commercial electronic messages are sent. Conspicuous publication is conditional, not automatic permission: assess relevance to the recipient's role, any contrary notice, identification, unsubscribe handling, and retained evidence.",
  },
] as const;

type Props = { params: Promise<{ region: string }> };
export const dynamicParams = false;

export function generateStaticParams() {
  return REGIONS.map(({ slug }) => ({ region: slug }));
}

async function getRegion(params: Props["params"]) {
  const { region } = await params;
  const content = REGIONS.find(({ slug }) => slug === region);
  if (!content) notFound();
  return content;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const content = await getRegion(params);
  return {
    title: `${content.name} technical B2B service workflows | CraftMyFunnel`,
    description: content.description,
    alternates: { canonical: `https://craftmyfunnel.live/use-cases/regions/${content.slug}` },
  };
}

export default async function RegionalUseCasePage({ params }: Props) {
  const content = await getRegion(params);
  return <div className="min-h-screen bg-[#020617] text-slate-100"><div className="mx-auto max-w-6xl px-6 pb-24 pt-32 sm:px-8">
    <Link href="/use-cases" className="text-sm font-semibold text-cyan-300 underline underline-offset-4">Explore service workflows</Link>
    <header className="mt-10 max-w-4xl"><p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">{content.name}</p><h1 className="mt-5 text-4xl font-black leading-tight tracking-tight sm:text-5xl">{content.title}</h1><p className="mt-6 text-lg leading-8 text-slate-300">{content.description}</p><div className="mt-8 flex flex-wrap gap-4"><Link href="/contact" className="rounded-xl bg-cyan-300 px-6 py-3 font-bold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">Discuss a pilot</Link><Link href="/pricing" className="rounded-xl border border-slate-600 px-6 py-3 font-semibold transition hover:border-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">Review USD plans</Link></div></header>
    <section className="mt-20" aria-labelledby="scenarios-title"><h2 id="scenarios-title" className="text-3xl font-bold">Examples to discuss with your team</h2><div className="mt-8 grid gap-5 md:grid-cols-3">{content.scenarios.map((scenario) => <article key={scenario} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-7"><p className="text-sm leading-7 text-slate-300">{scenario}</p></article>)}</div></section>
    <section className="mt-20 grid gap-8 lg:grid-cols-2"><article className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8"><h2 className="text-2xl font-bold">How to use the workflow</h2><ol className="mt-5 space-y-3 text-sm leading-7 text-slate-300"><li>1. Select eligible accounts for one service and buyer group.</li><li>2. Prepare drafts from verified account context.</li><li>3. Review recipients and messages before configuring any supported follow-up.</li><li>4. Review replies, activity, and the next commercial step.</li></ol></article><article className="rounded-3xl border border-amber-300/20 bg-amber-300/5 p-8"><h2 className="text-2xl font-bold">Responsible outreach check</h2><p className="mt-5 text-sm leading-7 text-slate-200">{content.guidance}</p><p className="mt-5 text-sm leading-7 text-slate-300">CraftMyFunnel supports preparation and tracking. Your team remains responsible for lawful outreach practices, recipient eligibility, sender identification, and unsubscribe handling.</p></article></section>
    <section className="mt-20 rounded-3xl border border-slate-800 bg-slate-900/60 p-8"><h2 className="text-2xl font-bold">Proposed 30-day evaluation</h2><p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">Week 1: select one service, cohort, and small eligible account set. Week 2: review recipients and messages, confirm sender setup, and begin outreach when your team has completed its eligibility checks. Week 3: review replies and refine relevance. Week 4: assess usable account records, time spent preparing outreach, completed follow-ups, relevant replies, and conversations before deciding whether to continue.</p><div className="mt-6 flex flex-wrap gap-5 text-sm"><Link href="/privacy" className="font-semibold text-cyan-300 underline underline-offset-4">Privacy information</Link><Link href="/security" className="font-semibold text-cyan-300 underline underline-offset-4">Security information</Link><Link href="/contact" className="font-semibold text-cyan-300 underline underline-offset-4">Discuss a pilot</Link></div></section>
  </div></div>;
}
