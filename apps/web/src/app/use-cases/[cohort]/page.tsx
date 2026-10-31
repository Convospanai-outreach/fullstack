import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const COHORTS = [
  {
    slug: "cybersecurity",
    label: "Cybersecurity consultancies & MSSPs",
    title: "Keep security sales moving between conversations.",
    description: "Prepare researched accounts, review outreach drafts and track the next step for security consulting and managed security opportunities.",
    challenge: "Technical credibility gets you into a conversation. Scattered account notes and unclear follow-up ownership can leave the next conversation waiting.",
    buyer: "Founders, commercial leaders and sales heads at cybersecurity service firms.",
    notFit: "It may not fit teams looking for security assessment delivery, vulnerability detection, or an automated outbound service.",
    limits: "CraftMyFunnel does not perform security assessments, identify a prospect's vulnerabilities, or establish recipient eligibility for you.",
    situations: [
      ["Account context is scattered", "Keep researched leads and their conversation history in a shared workflow."],
      ["Technical messages need careful review", "Prepare email drafts for your team to check before enrolling a campaign."],
      ["A proposal has no clear next step", "Track lead status and use the activity timeline to review the next follow-up."],
    ],
    example: ["Select a security service and a researched account group.", "Prepare a message about the account's stated business context.", "Review recipients, message content, and sender setup before beginning outreach.", "Review replies and record the next step with your commercial team."],
    pilot: "One security service, one geography and a small group of researched business accounts.",
    faq: [["Does this find security vulnerabilities?", "No. The workflow organizes account context and commercial follow-up; it does not assess a prospect's security posture."], ["Does every message require an enforced approval?", "Review is a recommended operator step. Confirm the process your team will use before any outreach begins."]],
  },
  {
    slug: "managed-it-cloud",
    label: "Managed IT & cloud service firms",
    title: "Keep account follow-up moving while your team delivers.",
    description: "Bring managed IT and cloud prospecting into a shared workflow for researched leads, reviewed email drafts and follow-up tracking.",
    challenge: "Delivery work takes priority. When prospect context stays in individual inboxes, the commercial team spends time reconstructing what happened and who should follow up.",
    buyer: "Owners, growth directors and commercial heads at MSPs and cloud consultancies.",
    notFit: "It may not fit teams seeking contract-renewal detection, migration-intent detection, or a fully managed sales service.",
    limits: "CraftMyFunnel does not know a prospect's renewal date or detect migration intent unless your team has supplied relevant context.",
    situations: [
      ["Delivery and sales share a small team", "Prepare the account list and outreach drafts before the campaign starts."],
      ["Several people touch the same account", "Review lead history and campaign activity in one place."],
      ["A retainer conversation goes quiet", "Track the lead's stage and review the next follow-up with its owner."],
    ],
    example: ["Choose one managed service or cloud migration offer.", "Import a researched account list and check its relevance.", "Review the messages and configure a connected sender.", "Track replies and hand relevant conversations to your team."],
    pilot: "One managed service or cloud offer, one geography and a small researched account group.",
    faq: [["Can it identify companies about to migrate to the cloud?", "No. Use your own research and account context to decide which companies to review."], ["Can it replace a sales owner?", "No. A team member remains responsible for recipient checks, message review, and next steps."]],
  },
  {
    slug: "ai-data-erp",
    label: "AI, data & ERP consultancies",
    title: "Give every project opportunity a clear next step.",
    description: "Prepare account research, review service-specific email drafts and track consultative sales follow-up for AI, data and ERP projects.",
    challenge: "Broad capability lists make a weak first message. A project conversation needs a specific business problem, a relevant service and continuity when a founder hands it to a colleague.",
    buyer: "Founders, partners and growth leaders at AI, data and ERP implementation firms.",
    notFit: "It may not fit teams seeking AI or ERP implementation delivery, proprietary ERP buying signals, or autonomous outbound execution.",
    limits: "CraftMyFunnel does not implement AI or ERP systems and does not claim access to proprietary ERP buying signals.",
    situations: [
      ["The first message lists too many services", "Build a campaign around one service and one researched buyer group."],
      ["Founder-led conversations need a handoff", "Keep lead context and campaign activity available to the team."],
      ["Each project has a different buying journey", "Review email drafts and track lead stages as the conversation develops."],
    ],
    example: ["Choose one implementation service and a specific business challenge.", "Check the account research before preparing the message.", "Review the sequence copy and sender configuration.", "Track replies and record the next discovery or proposal step."],
    pilot: "One AI, data or ERP service, one geography and one defined buyer group.",
    faq: [["Does this implement AI, data, or ERP systems?", "No. It supports the commercial workflow around your own services."], ["Does it know which companies are buying ERP?", "No. Select accounts using your own research and validate relevance before outreach."]],
  },
];

type Props = { params: Promise<{ cohort: string }> };
export const dynamicParams = false;

export function generateStaticParams() {
  return COHORTS.map(({ slug }) => ({ cohort: slug }));
}

async function getCohort(params: Props["params"]) {
  const { cohort } = await params;
  const content = COHORTS.find(({ slug }) => slug === cohort);
  if (!content) notFound();
  return content;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const content = await getCohort(params);
  return {
    title: content.label + " | CraftMyFunnel",
    description: content.description,
    alternates: { canonical: "https://craftmyfunnel.live/use-cases/" + content.slug },
    openGraph: { title: content.title, description: content.description },
  };
}

export default async function CohortSolutionPage({ params }: Props) {
  const content = await getCohort(params);
  return (
    <div className="min-h-screen bg-[#020617] text-slate-100">
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-32 sm:px-8">
        <Link href="/#industries" className="text-sm text-cyan-300 underline underline-offset-4">Explore service industries</Link>
        <section className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr]" aria-labelledby="solution-title">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">{content.label}</p>
            <h1 id="solution-title" className="mt-5 text-4xl font-black leading-tight tracking-tight sm:text-5xl">{content.title}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">{content.description}</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/contact" className="rounded-xl bg-cyan-300 px-6 py-3 font-bold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">Discuss a 30-day pilot</Link>
              <Link href="#workflow" className="rounded-xl border border-slate-600 px-6 py-3 font-semibold hover:border-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">See the workflow</Link>
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-400">{content.buyer}</p>
          </div>
          <aside className="rounded-3xl border border-cyan-300/20 bg-slate-900/70 p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">The challenge to test</p>
            <p className="mt-4 text-xl font-semibold leading-8">{content.challenge}</p>
            <p className="mt-6 border-t border-slate-700 pt-6 text-sm leading-7 text-slate-300">CraftMyFunnel brings lead context, reviewed campaign copy and follow-up tracking into a governed workflow your team can operate.</p>
          </aside>
        </section>

        <section className="mt-12 grid gap-5 md:grid-cols-2" aria-label="Fit and limits">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-7"><h2 className="text-xl font-bold">Who it may fit</h2><p className="mt-4 text-sm leading-7 text-slate-300">{content.buyer}</p><p className="mt-4 text-sm leading-7 text-slate-400">{content.notFit}</p></article>
          <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-7"><h2 className="text-xl font-bold">Supported scope and limits</h2><p className="mt-4 text-sm leading-7 text-slate-300">CraftMyFunnel can organize account context, help prepare outreach drafts, and track follow-up activity. {content.limits}</p></article>
        </section>

        <section className="mt-20" aria-labelledby="challenges-title">
          <h2 id="challenges-title" className="text-3xl font-bold">Start with the problem your team actually has.</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {content.situations.map(([challenge, solution]) => (
              <article key={challenge} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-7">
                <h3 className="text-lg font-bold">{challenge}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-300">{solution}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="workflow" className="mt-20 scroll-mt-28 rounded-3xl border border-slate-800 bg-slate-900/50 p-7 sm:p-10" aria-labelledby="workflow-title">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Illustrative workflow</p>
          <h2 id="workflow-title" className="mt-3 text-3xl font-bold">One offer. A reviewed message. A visible next step.</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2">
            {content.example.map((step, index) => (
              <li key={step} className="flex gap-4 text-sm leading-7 text-slate-300">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-300/10 font-bold text-cyan-300">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-20 grid gap-8 lg:grid-cols-2" aria-labelledby="pilot-title">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">A focused pilot</p>
            <h2 id="pilot-title" className="mt-3 text-3xl font-bold">Test the workflow with your own team.</h2>
            <p className="mt-5 leading-8 text-slate-300">{content.pilot}</p>
            <ol className="mt-5 space-y-3 text-sm leading-7 text-slate-300"><li><strong>Week 1:</strong> choose one service, cohort, and small eligible account set; confirm setup.</li><li><strong>Week 2:</strong> review recipients and messages, confirm sender setup, and begin outreach when your team has completed its eligibility checks.</li><li><strong>Week 3:</strong> review replies and refine relevance.</li><li><strong>Week 4:</strong> assess workflow usefulness and decide whether to continue.</li></ol>
            <p className="mt-4 text-sm leading-7 text-slate-300">Evaluate usable account records, time spent preparing outreach, completed follow-ups, relevant replies, and conversations. Treat these as workflow measures, not promised meetings, pipeline, or revenue.</p>
            <div className="mt-7 flex flex-wrap gap-5">
              <Link href="/contact" className="font-semibold text-cyan-300 underline underline-offset-4">Discuss your pilot</Link>
              <Link href="/pricing" className="font-semibold text-cyan-300 underline underline-offset-4">Review plans</Link>
            </div>
          </div>
          <aside className="rounded-2xl border border-slate-800 p-7">
            <h3 className="text-xl font-bold">Review the operating details.</h3>
            <p className="mt-4 text-sm leading-7 text-slate-300">Use the pilot to check sender setup, team access, data handling and the review process with the people who will run it.</p>
            <div className="mt-6 flex flex-wrap gap-5 text-sm">
              <Link href="/security" className="text-cyan-300 underline underline-offset-4">Security information</Link>
              <Link href="/privacy" className="text-cyan-300 underline underline-offset-4">Privacy information</Link>
            </div>
          </aside>
        </section>

        <section className="mt-20" aria-labelledby="faq-title"><h2 id="faq-title" className="text-3xl font-bold">Frequently asked questions</h2><div className="mt-8 grid gap-5 md:grid-cols-2">{content.faq.map(([question, answer]) => <article key={question} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-7"><h3 className="text-lg font-bold">{question}</h3><p className="mt-4 text-sm leading-7 text-slate-300">{answer}</p></article>)}</div></section>
        <p className="mt-16 max-w-4xl text-sm leading-7 text-slate-400">CraftMyFunnel helps teams prepare and manage outreach and track follow-up. Results depend on account selection, message relevance, lawful outreach practices, and your sales process. Meetings, pipeline, and revenue are not guaranteed. Review recipient eligibility and applicable marketing rules before sending; a publicly available email address does not automatically establish permission to contact its owner.</p>
      </div>
    </div>
  );
}
