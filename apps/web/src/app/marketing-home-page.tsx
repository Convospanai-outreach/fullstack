import Link from "next/link";
import { ArrowRight, CheckCircle, ChevronDown, ClipboardCheck, Network, PhoneCall, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const navGroups = [
  { label: "Solutions", href: "#workflow", items: ["Buyer Signal Intelligence", "Multi-Channel Outreach", "Human Approval Workflow", "Human Calling Layer", "Meeting Qualification"] },
  { label: "Platform", href: "#platform", items: ["Command Center", "NetJana Intelligence", "Outreach Engine", "Workflow Automation", "Governance Controls"] },
  { label: "Industries", href: "#industries", items: ["Facility Management", "Security Services", "Staffing", "L&D Companies", "Consulting Firms", "Managed Services"] },
  { label: "Pilot", href: "#pilot", items: ["GTM Playbooks", "Revenue Guides", "FAQs", "Pilot Program"] },
];

const trustBadges = ["Human Approved", "Governed Outreach", "Multi Channel", "Enterprise Ready"];
const serviceTeams = ["Facility Management", "Security Services", "Staffing", "Consulting", "L&D", "Managed Services"];
const flowSteps = ["Buyer Signals", "Signal Qualification", "Human Review", "Email Outreach", "LinkedIn Outreach", "WhatsApp Engagement", "Human Caller", "Qualified Meeting"];
const netjanaSignals = ["Hiring Expansion", "Branch Openings", "Tender Activity", "Facility Expansion", "Procurement Changes", "Technology Adoption", "Management Changes", "Growth Announcements"];
const pilotWeeks = [["Week 1", "Signal Setup"], ["Week 2", "Qualification Rules"], ["Week 3", "Multi Channel Outreach"], ["Week 4", "Qualified Meetings"]];
const footerLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/support", label: "Support" },
  { href: "/data-deletion", label: "Data Deletion" },
  { href: "/security", label: "Security" },
  { href: "/google-api-disclosure", label: "Google API Disclosure" },
];

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[22px] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/20 backdrop-blur-2xl ${className}`}>{children}</div>;
}

function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#050d17]/80 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-black text-white">CraftMyFunnel</Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {navGroups.map((group) => (
            <div key={group.label} className="group relative">
              <a href={group.href} className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white">{group.label}<ChevronDown className="h-3.5 w-3.5" /></a>
              <div className="invisible absolute left-0 top-full mt-3 w-72 translate-y-2 rounded-2xl border border-white/10 bg-[#07131f]/95 p-3 opacity-0 shadow-2xl shadow-black/40 backdrop-blur-2xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                {group.items.map((item) => <a key={item} href={group.href} className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white">{item}</a>)}
              </div>
            </div>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 md:flex lg:hidden">{navGroups.slice(0, 3).map((group) => <a key={group.label} href={group.href} className="text-xs font-semibold text-slate-300 hover:text-white">{group.label}</a>)}</div>
          <Link href="/login" className="hidden text-sm font-semibold text-slate-300 hover:text-white sm:block">Login</Link>
          <Link href="/signup"><Button className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-5 text-white shadow-lg shadow-violet-900/25">Book Demo</Button></Link>
        </div>
      </div>
    </header>
  );
}

function ProductDashboardPreview() {
  const signals = [["Expansion Activity", "4"], ["Hiring Activity", "6"], ["Procurement Indicators", "5"], ["Funding Signals", "2"]];
  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-[36px] border border-white/8 bg-white/[0.025] backdrop-blur-xl" />
      <GlassCard className="relative overflow-hidden p-5">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-300">Command Center</p><h2 className="mt-1 text-xl font-black text-white">Revenue workflow cockpit</h2></div>
          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold text-emerald-200">Human approval active</span>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <GlassCard className="p-4"><p className="text-sm text-slate-400">Signal Queue</p><div className="mt-1 flex items-end justify-between"><p className="text-4xl font-black text-white">15</p><p className="text-sm font-semibold text-cyan-200">New Buyer Signals</p></div><div className="mt-5 space-y-3">{signals.map(([label, value]) => <div key={label} className="flex items-center justify-between rounded-xl bg-white/[0.045] px-3 py-2.5"><span className="text-xs text-slate-300">{label}</span><span className="font-black text-white">{value}</span></div>)}</div></GlassCard>
          <div className="space-y-4"><GlassCard className="p-4"><p className="text-sm text-slate-400">Review Queue</p><p className="mt-2 text-3xl font-black text-white">7</p><p className="text-xs text-amber-200">Pending Approvals</p></GlassCard><GlassCard className="p-4"><p className="text-sm text-slate-400">Meetings</p><p className="mt-2 text-3xl font-black text-white">12</p><p className="text-xs text-emerald-200">Qualified Meetings</p><p className="mt-3 rounded-xl bg-white/[0.05] px-3 py-2 text-xs text-slate-300">Pipeline Value <span className="float-right font-black text-white">₹48L</span></p></GlassCard></div>
        </div>
        <GlassCard className="mt-4 p-4"><div className="mb-3 flex items-center justify-between"><p className="text-sm text-slate-400">Outreach Activity</p><span className="text-xs text-violet-200">Caller Assigned</span></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{["Email", "LinkedIn", "WhatsApp", "Caller"].map((item) => <div key={item} className="rounded-xl border border-white/8 bg-[#07131f]/70 px-3 py-3 text-center text-xs font-bold text-slate-200">{item}</div>)}</div></GlassCard>
      </GlassCard>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#050d17] text-slate-100">
      <Header />
      <section className="relative overflow-hidden pt-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent)]" />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-6 pb-24 lg:min-h-[780px] lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-slate-300 backdrop-blur-xl"><Sparkles className="h-4 w-4 text-violet-300" /> Governed funnel orchestration for service companies</div>
            <h1 className="max-w-3xl text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">Convert Buyer Signals Into Qualified Meetings</h1>
            <p className="mt-7 max-w-2xl text-xl leading-8 text-slate-300">CraftMyFunnel combines buyer intelligence, governed outreach, human approval workflows and real callers to help service companies generate qualified meetings without building large SDR teams.</p>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row"><Link href="/signup"><Button className="h-auto gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-9 py-4 text-base font-bold text-white shadow-lg shadow-violet-900/30">Book Demo<ArrowRight className="h-4 w-4" /></Button></Link><a href="#platform"><Button variant="outline" className="h-auto rounded-full border-white/15 bg-white/[0.04] px-9 py-4 text-base text-white backdrop-blur-xl hover:bg-white/[0.08]">See Platform</Button></a></div>
            <div className="mt-8 flex flex-wrap gap-3">{trustBadges.map((badge) => <span key={badge} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-300 backdrop-blur-xl"><CheckCircle className="mr-2 inline h-4 w-4 text-emerald-300" />{badge}</span>)}</div>
          </div>
          <ProductDashboardPreview />
        </div>
      </section>

      <section className="border-y border-white/8 bg-white/[0.018] py-7"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-4 px-6">{serviceTeams.map((team) => <span key={team} className="rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-sm font-semibold text-slate-300">{team}</span>)}</div></section>

      <section id="workflow" className="py-24"><div className="mx-auto max-w-7xl px-6"><h2 className="text-4xl font-black text-white sm:text-5xl">How CraftMyFunnel Works</h2><p className="mt-4 max-w-2xl text-lg text-slate-400">One controlled path from market signal to qualified meeting.</p><div className="mt-12 grid gap-3 lg:grid-cols-8">{flowSteps.map((step, index) => <div key={step} className="group relative rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur-xl transition hover:-translate-y-1 hover:bg-white/[0.06]"><p className="text-xs font-black text-violet-300">{String(index + 1).padStart(2, "0")}</p><p className="mt-3 text-sm font-bold text-white">{step}</p>{index < flowSteps.length - 1 && <ArrowRight className="absolute -right-5 top-1/2 hidden h-5 w-5 text-slate-600 lg:block" />}</div>)}</div></div></section>

      <section id="platform" className="border-y border-white/8 bg-white/[0.015] py-24"><div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[0.8fr_1.2fr]"><div><div className="mb-5 inline-flex rounded-full border border-cyan-300/15 bg-cyan-300/8 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300"><Network className="mr-2 h-4 w-4" />NetJana</div><h2 className="text-4xl font-black text-white sm:text-5xl">NetJana Intelligence Layer</h2><p className="mt-4 text-lg text-slate-400">Signals before competitors notice them.</p></div><div className="grid gap-4 sm:grid-cols-2">{netjanaSignals.map((signal) => <GlassCard key={signal} className="p-5 transition hover:-translate-y-1 hover:border-cyan-300/25"><TrendingUp className="mb-4 h-5 w-5 text-cyan-300" /><h3 className="font-bold text-white">{signal}</h3><p className="mt-2 text-sm leading-6 text-slate-400">Prioritize accounts showing visible market movement and outreach timing.</p></GlassCard>)}</div></div></section>

      <section className="py-24"><div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-2 lg:items-center"><div><h2 className="text-4xl font-black text-white sm:text-5xl">AI Identifies. Humans Qualify.</h2><p className="mt-4 text-lg text-slate-400">The caller layer turns signal-led interest into real qualification, meeting confirmation and reduced lead leakage.</p><div className="mt-8 grid gap-3 sm:grid-cols-2">{["Higher conversion", "Contextual conversations", "Reduced lead leakage", "Real qualification", "Meeting confirmation"].map((benefit) => <span key={benefit} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm font-bold text-slate-200"><PhoneCall className="mb-3 h-5 w-5 text-emerald-300" />{benefit}</span>)}</div></div><GlassCard className="p-8"><div className="grid gap-4">{["AI Engine", "Review Queue", "Human Caller", "Qualified Meeting"].map((step, index) => <div key={step} className="flex items-center justify-between rounded-2xl bg-white/[0.04] p-4"><span className="font-bold text-white">{step}</span><span className="text-xs text-slate-400">0{index + 1}</span></div>)}</div></GlassCard></div></section>

      <section className="border-y border-white/8 bg-white/[0.015] py-24"><div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-2"><div><ShieldCheck className="mb-5 h-10 w-10 text-violet-300" /><h2 className="text-4xl font-black text-white sm:text-5xl">Enterprise Governance Built In</h2><p className="mt-4 text-lg text-slate-400">No autonomous sending. Human approval stays mandatory for launch decisions and brand-sensitive outreach.</p></div><div className="grid gap-4">{["AI Draft Created", "Manager Approval", "Compliance Check", "Outreach Sent"].map((step) => <GlassCard key={step} className="flex items-center gap-4 p-5"><ClipboardCheck className="h-5 w-5 text-violet-300" /><span className="font-bold text-white">{step}</span></GlassCard>)}<div className="grid gap-3 sm:grid-cols-3">{["Human approval mandatory", "Audit trail maintained", "Full visibility"].map((item) => <span key={item} className="rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-slate-300">{item}</span>)}</div></div></div></section>

      <section id="industries" className="py-24"><div className="mx-auto max-w-7xl px-6"><h2 className="text-4xl font-black text-white sm:text-5xl">Industry Use Cases</h2><div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{serviceTeams.map((team) => <GlassCard key={team} className="p-6 transition hover:-translate-y-1 hover:border-violet-300/25"><h3 className="text-xl font-black text-white">{team}</h3><p className="mt-4 text-sm leading-7 text-slate-400"><b className="text-slate-200">Signals:</b> hiring, expansion, tenders or growth activity.<br /><b className="text-slate-200">Workflow:</b> approved email, LinkedIn, WhatsApp and caller follow-up.<br /><b className="text-slate-200">Outcome:</b> qualified meeting with context.</p></GlassCard>)}</div></div></section>

      <section id="pilot" className="relative mx-auto max-w-6xl px-6 py-28 text-center"><GlassCard className="p-10 sm:p-14"><h2 className="text-4xl font-black text-white sm:text-5xl">Launch In 30 Days</h2><div className="mt-10 grid gap-4 sm:grid-cols-4">{pilotWeeks.map(([week, title]) => <div key={week} className="rounded-2xl border border-white/10 bg-[#07131f]/70 p-5"><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">{week}</p><p className="mt-3 font-black text-white">{title}</p></div>)}</div><div className="mt-10"><Link href="/signup"><Button className="h-auto gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-10 py-4 text-base font-bold text-white">Start Guided Pilot<ArrowRight className="h-4 w-4" /></Button></Link></div></GlassCard></section>

      <footer className="border-t border-white/8 bg-black/20 px-6 py-10"><div className="mx-auto flex max-w-7xl flex-col gap-6 text-center text-sm text-slate-400 md:flex-row md:items-center md:justify-between md:text-left"><div><p className="font-semibold text-white">CraftMyFunnel</p><p className="mt-1">Copyright 2026 CraftMyFunnel. All rights reserved.</p><a className="mt-1 inline-block text-cyan-300 underline" href="mailto:support@craftmyfunnel.live">support@craftmyfunnel.live</a></div><nav className="flex flex-wrap justify-center gap-4 md:justify-end">{footerLinks.map((link) => <Link key={link.href} href={link.href} className="hover:text-white">{link.label}</Link>)}</nav></div></footer>
    </div>
  );
}
