import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle, Lock, Mail, Sparkles, TrendingUp, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const stats = [
    { number: "6", label: "funnel workflow stages" },
    { number: "100%", label: "human approval control" },
    { number: "ICP", label: "vertical playbooks" },
    { number: "Meetings", label: "primary outcome" },
];

const features = [
    { icon: TrendingUp, color: "from-violet-500/20 to-violet-600/5 border-violet-500/20 text-violet-400", title: "Detect buyer signals", description: "Spot companies showing intent and prioritize the accounts most likely to become qualified conversations." },
    { icon: Users, color: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/20 text-emerald-400", title: "Enrich and qualify leads", description: "Turn raw targets into review-ready records with company context, contact data, and fit checks." },
    { icon: Mail, color: "from-amber-500/20 to-amber-600/5 border-amber-500/20 text-amber-400", title: "Create campaigns and funnels", description: "Prepare approved outreach and campaign landing funnels around one ICP, geography, and offer." },
    { icon: Lock, color: "from-cyan-500/20 to-cyan-600/5 border-cyan-500/20 text-cyan-400", title: "Launch with governance", description: "Keep humans in control of critical sends, approvals, and brand-risk decisions before campaigns go live." },
    { icon: Zap, color: "from-pink-500/20 to-pink-600/5 border-pink-500/20 text-pink-400", title: "Manage follow-ups", description: "Coordinate replies, caller notes, and next steps so warm leads do not stall after the first response." },
    { icon: BarChart3, color: "from-orange-500/20 to-orange-600/5 border-orange-500/20 text-orange-400", title: "Track meetings and pipeline", description: "Measure qualified leads, booked meetings, follow-up progress, and conversion outcomes." },
];

const serviceTeams = ["Facility & security services", "Staffing & manpower services", "L&D and training companies", "Consulting and managed services", "Managed service providers", "B2B support teams"];

const workflowExamples = [
    { title: "Signal-led funnel start", description: "Identify accounts showing demand signals and prepare them for human review." },
    { title: "Governed outreach launch", description: "Keep approvals, sender readiness, and brand controls in the same workflow." },
    { title: "Meeting-focused follow-up", description: "Track replies, warm leads, booked meetings, and next-step ownership." },
];

const playbooks = [
    { n: "01", title: "Facility and security services", desc: "Target enterprises with signal-led outreach, proof assets, and approval-safe follow-ups." },
    { n: "02", title: "Staffing and manpower services", desc: "Run role-specific plays around hiring pressure, geography, and urgency." },
    { n: "03", title: "L&D and training companies", desc: "Convert training demand signals into qualified conversations with buyer-context messaging." },
    { n: "04", title: "Consulting and managed services", desc: "Package expertise into focused campaigns, landing funnels, and meeting-ready handoffs." },
];

const footerLinks = [
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms of Service" },
    { href: "/support", label: "Support" },
    { href: "/data-deletion", label: "Data Deletion" },
    { href: "/security", label: "Security" },
    { href: "/google-api-disclosure", label: "Google API Disclosure" },
];

export default function Home() {
    return (
        <div className="min-h-screen overflow-hidden bg-[#050d17] text-slate-100">
            <section className="relative overflow-hidden">
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute left-1/4 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[120px]" />
                    <div className="absolute right-1/4 top-1/3 h-[400px] w-[400px] rounded-full bg-cyan-600/8 blur-[100px]" />
                    <div className="absolute bottom-0 left-1/2 h-[300px] w-[800px] -translate-x-1/2 rounded-full bg-indigo-600/6 blur-[120px]" />
                </div>
                <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-20 text-center">
                    <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/10 px-5 py-2 text-sm text-violet-200 backdrop-blur-sm">
                        <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                        <span className="font-medium">AI-supported funnel workflows for B2B service companies</span>
                        <span className="ml-1 rounded-full bg-violet-500/30 px-2 py-0.5 text-xs font-semibold text-violet-200">New ✦</span>
                    </div>
                    <p className="mb-5 text-lg font-black text-white">CraftMyFunnel</p>
                    <h1 className="mx-auto max-w-5xl text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl xl:text-8xl">
                        Craft your funnel from buyer signal to <span className="relative inline-block"><span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400">qualified meeting.</span><span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 opacity-60" /></span>
                    </h1>
                    <p className="mx-auto mt-8 max-w-2xl text-xl leading-8 text-slate-300">CraftMyFunnel helps B2B service teams manage buyer signals, lead review, approved outreach, follow-ups, and qualified meeting tracking in one governed workflow.</p>
                    <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-400">Google Workspace and Gmail connections are used for user-approved mailbox setup and sending. Humans remain in control of approvals, launch decisions, and brand-sensitive sends.</p>
                    <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                        <Link href="/signup"><Button className="h-auto gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-10 py-4 text-base font-semibold text-white shadow-lg shadow-violet-500/25 transition-all duration-300 hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/40 hover:-translate-y-0.5">Start Guided Growth Pilot<ArrowRight className="h-4 w-4" /></Button></Link>
                        <Link href="/help"><Button variant="outline" className="h-auto rounded-full border-white/15 bg-white/[0.03] px-8 py-4 text-base text-white backdrop-blur-sm hover:bg-white/[0.08] hover:border-white/25">See Qualified Meeting Workflow</Button></Link>
                    </div>
                    <p className="mt-5 text-sm text-slate-400">Built for service companies that need qualified enterprise conversations without building a large inside-sales team.</p>
                    <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {stats.map((stat) => <div key={stat.label} className="rounded-2xl border border-white/8 bg-white/[0.03] py-5 px-4 backdrop-blur-sm"><p className="text-3xl font-black text-white">{stat.number}</p><p className="mt-1 text-sm text-slate-400">{stat.label}</p></div>)}
                    </div>
                </div>
            </section>

            <section className="border-y border-white/8 bg-white/[0.015] py-8"><div className="mx-auto max-w-7xl px-6"><p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Designed for service-led growth teams</p><div className="flex flex-wrap items-center justify-center gap-4">{serviceTeams.map((team) => <span key={team} className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-300">{team}</span>)}</div></div></section>

            <section className="mx-auto max-w-7xl px-6 py-24"><div className="mb-16 text-center"><p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-violet-400">From Buyer Signal to Qualified Meeting</p><h2 className="text-4xl font-black text-white sm:text-5xl">One managed workflow, not another tool to operate</h2><p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">CraftMyFunnel supports signal detection, lead enrichment, campaign preparation, approved outreach, follow-up review, and qualified-meeting tracking.</p></div><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{features.map((f) => <div key={f.title} className={`group relative overflow-hidden rounded-3xl border bg-gradient-to-br p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30 ${f.color}`}><div className="mb-5 inline-flex rounded-2xl bg-white/10 p-3"><f.icon className="h-5 w-5" /></div><h3 className="text-xl font-bold text-white">{f.title}</h3><p className="mt-2 text-sm leading-7 text-slate-300">{f.description}</p></div>)}</div></section>

            <section className="mx-auto max-w-7xl px-6 py-8 pb-24"><div className="mb-12 text-center"><p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-emerald-400">Pilot workflow examples</p><h2 className="text-4xl font-black text-white sm:text-5xl">Review-ready workflows without fake customer claims.</h2></div><div className="grid gap-6 sm:grid-cols-3">{workflowExamples.map((example) => <div key={example.title} className="rounded-3xl border border-white/8 bg-white/[0.03] p-7 transition-all duration-300 hover:border-violet-500/20 hover:bg-white/[0.05]"><div className="mb-4 inline-flex rounded-2xl bg-emerald-400/10 p-3 text-emerald-300"><CheckCircle className="h-5 w-5" /></div><h3 className="text-xl font-bold text-white">{example.title}</h3><p className="mt-3 text-sm leading-7 text-slate-300">{example.description}</p></div>)}</div></section>

            <section className="bg-white/[0.015] py-24 border-y border-white/8"><div className="mx-auto max-w-4xl px-6 text-center"><p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-400">Vertical playbooks</p><h2 className="text-4xl font-black text-white sm:text-5xl">Built around service-company markets</h2><div className="mt-14 grid gap-6 sm:grid-cols-2 text-left">{playbooks.map((step) => <div key={step.n} className="flex gap-5 rounded-2xl border border-white/8 bg-white/[0.03] p-6"><span className="text-4xl font-black text-white/10">{step.n}</span><div><h3 className="text-lg font-bold text-white">{step.title}</h3><p className="mt-1 text-sm leading-7 text-slate-400">{step.desc}</p></div></div>)}</div></div></section>

            <section className="mx-auto max-w-4xl px-6 py-28 text-center"><div className="relative overflow-hidden rounded-[40px] border border-violet-500/20 bg-gradient-to-br from-violet-900/30 via-indigo-900/20 to-transparent p-14 shadow-2xl shadow-violet-900/20"><div className="pointer-events-none absolute inset-0"><div className="absolute left-1/2 top-0 h-48 w-72 -translate-x-1/2 rounded-full bg-violet-500/15 blur-[80px]" /></div><div className="relative"><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-5 py-2 text-sm text-emerald-300"><CheckCircle className="h-4 w-4" />Qualified meeting pilot path</div><h2 className="text-4xl font-black text-white sm:text-5xl">Launch your funnel workflow</h2><p className="mx-auto mt-5 max-w-xl text-lg text-slate-300">Prepare approved outreach, managed follow-ups, and qualified meeting tracking for your service business.</p><div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"><Link href="/signup"><Button className="h-auto gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-10 py-4 text-base font-semibold text-white shadow-lg shadow-violet-500/25 transition-all duration-300 hover:from-violet-500 hover:to-indigo-500 hover:-translate-y-0.5">Start Guided Growth Pilot<ArrowRight className="h-4 w-4" /></Button></Link><Link href="/pricing"><Button variant="ghost" className="h-auto rounded-full px-8 py-4 text-base text-slate-300 hover:bg-white/[0.06] hover:text-white">See pilot options &rarr;</Button></Link></div><div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500"><span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Human approval</span><span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Vertical playbooks</span><span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-emerald-500" /> Human support</span><span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-emerald-500" /> Team collaboration</span></div></div></div></section>

            <footer className="border-t border-white/8 bg-black/20 px-6 py-10"><div className="mx-auto flex max-w-7xl flex-col gap-6 text-center text-sm text-slate-400 md:flex-row md:items-center md:justify-between md:text-left"><div><p className="font-semibold text-white">CraftMyFunnel</p><p className="mt-1">© 2026 CraftMyFunnel. All rights reserved.</p><a className="mt-1 inline-block text-cyan-300 underline" href="mailto:support@craftmyfunnel.live">support@craftmyfunnel.live</a></div><nav className="flex flex-wrap justify-center gap-4 md:justify-end">{footerLinks.map((link) => <Link key={link.href} href={link.href} className="hover:text-white">{link.label}</Link>)}</nav></div></footer>
        </div>
    );
}
