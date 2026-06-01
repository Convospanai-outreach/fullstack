import Link from "next/link";
import { ArrowRight, CheckCircle, ChevronDown, ClipboardCheck, Cpu, Database, HardDrive, Network, PhoneCall, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const navGroups = [
  { label: "Product", href: "#workflow", items: ["Buyer Signals", "Sequences", "Approvals", "Human Calling"] },
  { label: "Use Cases", href: "#industries", items: ["Facility Management", "Security", "Staffing", "L&D", "Consulting"] },
  { label: "Platform", href: "#platform", items: ["NetJana", "CMF Core", "Human Layer", "Covospan EDGE"] },
  { label: "Pilot", href: "#pilot", items: ["30-Day Launch", "Setup", "Qualification", "Meetings"] },
];

const trustBadges = ["Human approved", "Email + LinkedIn + WhatsApp", "Caller layer", "Sovereign EDGE optional"];
const serviceTeams = ["Facility Management", "Security Services", "Staffing", "Consulting", "L&D", "Managed Services"];
const flowSteps = ["Find buyer signals", "Create approved sequences", "Review before sending", "Run outreach", "Assign caller", "Book qualified meeting"];
const netjanaSignals = ["Hiring Expansion", "Branch Openings", "Tender Activity", "Facility Expansion", "Procurement Changes", "Technology Adoption"];
const architectureLayers = [
  { title: "NetJana", tag: "Buyer Signals", solves: "Who should I contact?", points: ["Intent detection engine", "Corporate activity tracking", "Decision-maker tracking"] },
  { title: "CMF Core", tag: "AI Outreach SaaS", solves: "How do I reach them?", points: ["Email sequences", "LinkedIn rails", "WhatsApp workflows"] },
  { title: "Human Layer", tag: "Conversion Moat", solves: "How do I secure meetings?", points: ["Managed callers", "Appointment fixing", "Pipeline nurturing"] },
  { title: "Covospan EDGE", tag: "Sovereign Edge Node", solves: "How do I deploy safely?", points: ["Raspberry Pi 5 node", "Encrypted local storage", "On-device logs"] },
];
const edgeTiers = [
  { title: "Tier 1 — Edge Hardware", text: "Raspberry Pi 5 edge node with secure boot, encrypted storage and firmware control." },
  { title: "Tier 2 — On-Device AI", text: "PII tokenisation, micro-LLM checks, adversarial critic and intent engine run close to the data." },
  { title: "Tier 3 — Hybrid Workflow", text: "AI outreach engine, human caller layer and optional external LLM support work through governed handoffs." },
];
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
  return <div className={`rounded-[28px] border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/25 backdrop-blur-2xl ${className}`}>{children}</div>;
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#080b1a]/88 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-black text-white"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 text-white">C</span>CraftMyFunnel</Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {navGroups.map((group) => (
            <div key={group.label} className="group relative">
              <a href={group.href} className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.07] hover:text-white">{group.label}<ChevronDown className="h-3.5 w-3.5" /></a>
              <div className="invisible absolute left-0 top-full mt-3 w-64 translate-y-2 rounded-2xl border border-white/10 bg-[#11152a]/95 p-3 opacity-0 shadow-2xl shadow-black/40 backdrop-blur-2xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                {group.items.map((item) => <a key={item} href={group.href} className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/[0.07] hover:text-white">{item}</a>)}
              </div>
            </div>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden text-sm font-semibold text-slate-300 hover:text-white sm:block">Login</Link>
          <Link href="/signup"><Button className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-5 font-bold text-white shadow-lg shadow-violet-500/25 hover:opacity-95">Start pilot</Button></Link>
        </div>
      </div>
    </header>
  );
}

function OutreachWidget({ className = "" }: { className?: string }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.08] p-4 text-white shadow-2xl shadow-black/20 backdrop-blur-2xl ${className}`}><div className="mb-3 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-cyan-400" /><span className="text-xs font-black uppercase tracking-widest text-cyan-200">Approval ready</span></div><p className="text-xs text-slate-300">Review and approve this sequence before it goes live.</p><div className="mt-3 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-3 py-2 text-center text-xs font-bold text-white">Approve</div></div>;
}

function ProductDashboardPreview() {
  const rows = [["Titan Facilities", "Expansion", "92", "Review"], ["NorthStar Security", "Hiring", "87", "Ready"], ["Urban Estates", "Procurement", "81", "Caller"], ["MetroWorks", "Tender", "78", "Queued"]];
  return (
    <div className="relative mx-auto max-w-3xl">
      <div className="absolute -inset-8 rounded-[44px] bg-[radial-gradient(circle_at_40%_35%,rgba(124,58,237,0.38),transparent_34%),radial-gradient(circle_at_80%_70%,rgba(34,211,238,0.24),transparent_30%)] blur-3xl" />
      <OutreachWidget className="absolute -right-3 -top-10 hidden w-52 rotate-[2deg] xl:block" />
      <OutreachWidget className="absolute -right-6 bottom-8 hidden w-52 rotate-[-2deg] xl:block" />
      <GlassCard className="relative overflow-hidden p-4">
        <div className="rounded-[22px] bg-gradient-to-br from-[#151a38] via-[#1c1f4b] to-[#4b145c] p-5 text-white ring-1 ring-white/10">
          <div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Live outreach workspace</p><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">Human approval on</span></div>
          <div className="mt-5 grid gap-4 lg:grid-cols-[0.65fr_1.35fr]">
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur"><p className="text-sm text-slate-300">Today</p><p className="mt-2 text-4xl font-black">42</p><p className="text-sm text-slate-300">review-ready leads</p><div className="mt-5 space-y-2 text-xs">{["Email sequence", "LinkedIn step", "Caller assigned"].map((item) => <div key={item} className="rounded-xl bg-white/10 px-3 py-2">{item}</div>)}</div></div>
            <div className="rounded-2xl border border-white/10 bg-[#10152c]/92 p-4 text-white shadow-xl"><div className="mb-3 flex items-center justify-between"><p className="font-black">Buyer signal table</p><span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-200">4 high intent</span></div><div className="space-y-2">{rows.map(([company, signal, score, status]) => <div key={company} className="grid grid-cols-[1.2fr_0.8fr_0.4fr_0.7fr] items-center gap-2 rounded-xl border border-white/8 bg-white/[0.06] px-3 py-3 text-xs"><span className="font-bold text-white">{company}</span><span className="text-slate-400">{signal}</span><span className="font-black text-cyan-300">{score}</span><span className="rounded-full bg-white/10 px-2 py-1 text-center font-bold text-slate-300">{status}</span></div>)}</div></div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[#070a18] text-white">
      <Header />
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_25%_20%,rgba(37,99,235,0.28),transparent_32%),radial-gradient(circle_at_68%_22%,rgba(124,58,237,0.34),transparent_34%),radial-gradient(circle_at_72%_80%,rgba(103,24,122,0.34),transparent_34%),linear-gradient(135deg,#070a18_0%,#11174a_48%,#2b0b3d_100%)] pt-20">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:72px_72px] opacity-40" />
        <div className="pointer-events-none absolute right-0 top-24 hidden w-36 flex-col gap-4 opacity-60 xl:flex">{Array.from({ length: 3 }).map((_, i) => <OutreachWidget key={i} className="w-52 translate-x-24" />)}</div>
        <div className="relative mx-auto grid max-w-7xl gap-14 px-6 pb-24 pt-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="text-center lg:text-left">
            <div className="mb-6 inline-flex items-center rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-sm font-bold text-cyan-200 backdrop-blur-xl"><Sparkles className="mr-2 h-4 w-4" />AI-approved funnel workflows for B2B service teams</div>
            <h1 className="mx-auto max-w-4xl text-5xl font-black tracking-tight text-white sm:text-6xl lg:mx-0 lg:text-7xl">Convert buyer signals into <span className="bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">qualified meetings</span></h1>
            <p className="mx-auto mt-6 max-w-2xl text-xl leading-8 text-slate-300 lg:mx-0">CraftMyFunnel helps service companies run signal-led outreach, human-approved sequences, WhatsApp follow-ups and caller-assisted meeting qualification from one clean workspace.</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start"><Link href="/signup"><Button className="h-auto gap-2 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-9 py-4 text-base font-bold text-white shadow-xl shadow-violet-500/25 hover:opacity-95">Start 30-day pilot<ArrowRight className="h-4 w-4" /></Button></Link><a href="#platform"><Button variant="outline" className="h-auto rounded-full border-white/15 bg-white/[0.08] px-9 py-4 text-base font-bold text-white shadow-lg backdrop-blur-xl hover:bg-white/[0.12]">Book demo</Button></a></div>
            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">{trustBadges.map((badge) => <span key={badge} className="rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-slate-200 shadow-sm backdrop-blur-xl"><CheckCircle className="mr-2 inline h-4 w-4 text-cyan-300" />{badge}</span>)}</div>
          </div>
          <ProductDashboardPreview />
        </div>
      </section>

      <section className="bg-[#11174a] py-20 text-white"><div className="mx-auto max-w-7xl px-6"><div className="mx-auto max-w-3xl text-center"><h2 className="text-4xl font-black sm:text-5xl">From full TAM to your top accounts, outreach still feels controlled.</h2><p className="mt-4 text-lg text-slate-300">Run outbound across email, LinkedIn, WhatsApp and phone without losing governance.</p></div><div className="mt-12 grid gap-5 md:grid-cols-3">{flowSteps.map((step, index) => <GlassCard key={step} className="p-6"><p className="text-xs font-black uppercase tracking-widest text-cyan-300">Step {index + 1}</p><h3 className="mt-3 text-xl font-black text-white">{step}</h3><p className="mt-2 text-sm leading-6 text-slate-300">Keep every action visible, approved and assigned before the next step starts.</p></GlassCard>)}</div></div></section>

      <section id="platform" className="bg-[#080b1a] py-24"><div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[0.8fr_1.2fr]"><div><div className="mb-5 inline-flex rounded-full bg-white/[0.08] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200"><Network className="mr-2 h-4 w-4" />NetJana</div><h2 className="text-4xl font-black text-white sm:text-5xl">Buyer signals before your competitors notice them.</h2><p className="mt-4 text-lg text-slate-300">Use market movement to prioritize the accounts most likely to respond.</p></div><div className="grid gap-4 sm:grid-cols-2">{netjanaSignals.map((signal) => <GlassCard key={signal} className="p-6"><TrendingUp className="mb-4 h-5 w-5 text-cyan-300" /><h3 className="font-black text-white">{signal}</h3><p className="mt-2 text-sm leading-6 text-slate-300">Prioritize accounts showing visible buying movement and outreach timing.</p></GlassCard>)}</div></div></section>

      <section id="workflow" className="bg-[#0b1020] py-24 text-white"><div className="mx-auto max-w-7xl px-6"><h2 className="text-4xl font-black sm:text-5xl">The CMF ecosystem</h2><p className="mt-4 max-w-2xl text-lg text-slate-300">NetJana, CMF Core, the Human Layer and Covospan EDGE work as one governed funnel system.</p><div className="mt-12 grid gap-5 lg:grid-cols-4">{architectureLayers.map((layer, index) => <GlassCard key={layer.title} className="p-6"><div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">{index === 0 ? <Network className="h-5 w-5" /> : index === 1 ? <Sparkles className="h-5 w-5" /> : index === 2 ? <PhoneCall className="h-5 w-5" /> : <HardDrive className="h-5 w-5" />}</div><h3 className="text-2xl font-black">{layer.title}</h3><p className="mt-2 inline-flex rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-cyan-200">{layer.tag}</p><p className="mt-5 text-sm font-bold text-slate-200">Solves: {layer.solves}</p><ul className="mt-4 space-y-3 text-sm text-slate-300">{layer.points.map((point) => <li key={point} className="flex gap-2"><CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />{point}</li>)}</ul></GlassCard>)}</div></div></section>

      <section className="bg-[#11174a] py-24"><div className="mx-auto max-w-7xl px-6"><div className="max-w-3xl"><div className="mb-5 inline-flex rounded-full bg-white/[0.08] px-4 py-2 text-xs font-black uppercase tracking-widest text-cyan-200"><Cpu className="mr-2 h-4 w-4" />Covospan EDGE</div><h2 className="text-4xl font-black text-white sm:text-5xl">Optional Raspberry Pi 5 edge node for sovereign deployment.</h2><p className="mt-4 text-lg text-slate-300">Secure boot, encrypted storage, local memory logs and governed processing close to the data.</p></div><div className="mt-10 grid gap-5 lg:grid-cols-3">{edgeTiers.map((tier) => <GlassCard key={tier.title} className="p-6"><Database className="mb-4 h-6 w-6 text-cyan-300" /><h3 className="text-xl font-black text-white">{tier.title}</h3><p className="mt-3 text-sm leading-7 text-slate-300">{tier.text}</p></GlassCard>)}</div></div></section>

      <section id="industries" className="bg-[#080b1a] py-24"><div className="mx-auto max-w-7xl px-6"><h2 className="text-4xl font-black text-white sm:text-5xl">Built for service-company markets</h2><div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{serviceTeams.map((team) => <GlassCard key={team} className="p-6"><h3 className="text-xl font-black text-white">{team}</h3><p className="mt-4 text-sm leading-7 text-slate-300"><b>Signals:</b> hiring, expansion, tenders or growth activity.<br /><b>Workflow:</b> approved email, LinkedIn, WhatsApp and caller follow-up.<br /><b>Outcome:</b> qualified meeting with context.</p></GlassCard>)}</div></div></section>

      <section id="pilot" className="bg-[#080b1a] px-6 py-24"><div className="mx-auto max-w-5xl rounded-[36px] border border-white/10 bg-gradient-to-br from-[#151a38] to-[#2b0b3d] p-10 text-center text-white shadow-2xl shadow-black/30 sm:p-14"><h2 className="text-4xl font-black sm:text-5xl">Launch your funnel workflow in 30 days</h2><div className="mt-10 grid gap-4 sm:grid-cols-4">{pilotWeeks.map(([week, title]) => <div key={week} className="rounded-2xl bg-white/10 p-5"><p className="text-xs font-bold uppercase tracking-widest text-cyan-200">{week}</p><p className="mt-3 font-black">{title}</p></div>)}</div><div className="mt-10"><Link href="/signup"><Button className="h-auto gap-2 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-10 py-4 text-base font-bold text-white hover:opacity-95">Start pilot<ArrowRight className="h-4 w-4" /></Button></Link></div></div></section>

      <footer className="border-t border-white/10 bg-[#070a18] px-6 py-10"><div className="mx-auto flex max-w-7xl flex-col gap-6 text-center text-sm text-slate-400 md:flex-row md:items-center md:justify-between md:text-left"><div><p className="font-semibold text-white">CraftMyFunnel</p><p className="mt-1">Copyright 2026 CraftMyFunnel. All rights reserved.</p><a className="mt-1 inline-block text-cyan-300 underline" href="mailto:support@craftmyfunnel.live">support@craftmyfunnel.live</a></div><nav className="flex flex-wrap justify-center gap-4 md:justify-end">{footerLinks.map((link) => <Link key={link.href} href={link.href} className="hover:text-white">{link.label}</Link>)}</nav></div></footer>
    </div>
  );
}
