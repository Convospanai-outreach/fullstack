import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Network,
  Cpu,
  Cloud,
  Lock,
  LineChart,
  UserPlus,
  Gauge,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import HeroScene from "@/components/marketing/HeroScene";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-hidden relative selection:bg-emerald-400/30">
      <HeroScene />

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-emerald-500/20 blur-[120px]" />
        <div className="absolute top-1/3 -right-10 h-80 w-80 rounded-full bg-cyan-500/20 blur-[140px]" />
        <div className="absolute bottom-[-8%] left-1/3 h-96 w-96 rounded-full bg-amber-400/15 blur-[160px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.3),transparent_55%)]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-28">
        {/* HERO */}
        <section className="pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-emerald-200">
            <Zap className="h-4 w-4 text-emerald-300" />
            Modern revenue architecture for AI-first teams
          </div>

          <h1 className="mt-8 text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight">
            A growth system built for trust, speed, and conversion
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto">
            ConvoSpan unifies web, core API, and edge intelligence into one
            cohesive stack. You get faster activation, cleaner data, and a clear
            path from visitor to signed-in user.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button className="h-auto px-8 py-4 text-base bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold">
                Start free
              </Button>
            </Link>
            <Link href="#architecture">
              <Button variant="outline" className="h-auto px-8 py-4 text-base border-white/15 hover:bg-white/5">
                See the architecture
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" className="h-auto px-6 py-4 text-base text-slate-200 hover:text-white">
                Sign in
              </Button>
            </Link>
          </div>

          <div className="mt-14 rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
              <Image
                src="/images/dashboard-preview.png"
                alt="ConvoSpan control plane"
                fill
                className="object-cover opacity-90"
                priority
              />
            </div>
          </div>
        </section>

        {/* ARCHITECTURE */}
        <section id="architecture" className="py-16">
          <div className="flex flex-col gap-4 text-center">
            <p className="text-emerald-300 text-sm uppercase tracking-[0.2em]">Current architecture</p>
            <h2 className="text-3xl sm:text-4xl font-semibold">Three services, one coherent system</h2>
            <p className="text-slate-300 max-w-3xl mx-auto">
              Each layer has a clear boundary and purpose. Together they form a
              secure pipeline from demand capture to execution and insight.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[
              {
                title: "Web control plane",
                desc: "The customer-facing workspace that explains value fast, drives conversion, and orchestrates everything.",
                icon: Cloud,
                stack: "apps/web",
                accent: "bg-emerald-500/20 text-emerald-200"
              },
              {
                title: "API core",
                desc: "The source of truth for campaigns, billing, workflows, and identity. Strict types keep the system sane.",
                icon: Network,
                stack: "apps/api",
                accent: "bg-cyan-500/20 text-cyan-200"
              },
              {
                title: "Edge AI runtime",
                desc: "FastAPI service for ML and enrichment when you need data to stay close to the source.",
                icon: Cpu,
                stack: "apps/edge-fastapi",
                accent: "bg-amber-400/20 text-amber-200"
              }
            ].map((item) => (
              <GlassCard key={item.title} className="p-6 h-full flex flex-col gap-4 border-white/10">
                <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${item.accent}`}>
                  <item.icon className="h-4 w-4" />
                  {item.stack}
                </div>
                <h3 className="text-xl font-semibold">{item.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{item.desc}</p>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* BENEFITS */}
        <section className="py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-semibold">Benefits built into the stack</h2>
              <p className="mt-4 text-slate-300">
                The architecture is not just tidy. It changes how fast teams
                activate accounts, secure data, and ship experiments.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  {
                    title: "Sovereign data paths",
                    desc: "Keep sensitive enrichment and ML close to the source with optional edge processing."
                  },
                  {
                    title: "Faster activation",
                    desc: "Dedicated web control plane shortens time-to-value without waiting on backend cycles."
                  },
                  {
                    title: "Operational clarity",
                    desc: "Strict API contracts reduce drift and make incident response predictable."
                  }
                ].map((item) => (
                  <div key={item.title} className="flex gap-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-300 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-slate-100">{item.title}</h3>
                      <p className="text-sm text-slate-300">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <GlassCard className="p-6 border-white/10">
              <div className="flex items-center gap-3">
                <Lock className="h-6 w-6 text-emerald-300" />
                <div>
                  <h3 className="text-lg font-semibold">Trust by design</h3>
                  <p className="text-sm text-slate-300">
                    Security, compliance, and predictable performance are no longer
                    afterthoughts. They are baked into the boundaries.
                  </p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 text-sm text-slate-300">
                <div className="rounded-xl border border-white/10 p-4">
                  <p className="text-slate-200 font-semibold">API guardrails</p>
                  <p className="mt-2">Strict typecheck and schema-first changes.</p>
                </div>
                <div className="rounded-xl border border-white/10 p-4">
                  <p className="text-slate-200 font-semibold">Edge isolation</p>
                  <p className="mt-2">Compute stays close to regulated data.</p>
                </div>
                <div className="rounded-xl border border-white/10 p-4">
                  <p className="text-slate-200 font-semibold">Clear ownership</p>
                  <p className="mt-2">Web, API, and ML release independently.</p>
                </div>
                <div className="rounded-xl border border-white/10 p-4">
                  <p className="text-slate-200 font-semibold">Measured rollout</p>
                  <p className="mt-2">Health checks and gates keep deploys safe.</p>
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* CONVERSION */}
        <section className="py-16">
          <div className="text-center">
            <p className="text-emerald-300 text-sm uppercase tracking-[0.2em]">Conversion path</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-semibold">
              How we turn customers into signed-in users
            </h2>
            <p className="mt-4 text-slate-300 max-w-3xl mx-auto">
              Every page is designed to reduce friction and show value fast.
              Conversion is not a single CTA. It is an experience.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: "Show value in 2 minutes",
                desc: "Instant previews and proof points make the benefit obvious.",
                icon: Gauge
              },
              {
                title: "Trust signals before forms",
                desc: "Explain data boundaries, edge isolation, and compliance early.",
                icon: Lock
              },
              {
                title: "Frictionless sign-up",
                desc: "Short forms, SSO ready, and guided onboarding flows.",
                icon: UserPlus
              },
              {
                title: "Activation milestones",
                desc: "Clear next steps: connect accounts, launch a workflow, ship results.",
                icon: LineChart
              }
            ].map((item) => (
              <GlassCard key={item.title} className="p-6 border-white/10">
                <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <item.icon className="h-5 w-5 text-emerald-300" />
                </div>
                <h3 className="mt-4 font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{item.desc}</p>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* NETJANA */}
        <section className="py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-emerald-300 text-sm uppercase tracking-[0.2em]">Netjana.ai</p>
              <h2 className="mt-3 text-3xl sm:text-4xl font-semibold">
                The intelligence layer for compliant enrichment
              </h2>
              <p className="mt-4 text-slate-300">
                Netjana.ai powers the edge runtime, bringing enrichment, scoring,
                and research closer to where your data lives. You get faster
                insights without forcing sensitive context into external systems.
              </p>
              <div className="mt-6 flex items-center gap-3 text-sm text-slate-300">
                <Sparkles className="h-4 w-4 text-amber-200" />
                Built for regulated teams that need AI without data sprawl.
              </div>
            </div>
            <GlassCard className="p-6 border-white/10">
              <div className="flex items-center gap-3">
                <Cpu className="h-6 w-6 text-amber-200" />
                <div>
                  <h3 className="text-lg font-semibold">Edge-first workflows</h3>
                  <p className="text-sm text-slate-300">
                    Netjana.ai runs where you choose, then syncs safe outputs back
                    to ConvoSpan for orchestration.
                  </p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-4 text-sm text-slate-300">
                <div className="rounded-xl border border-white/10 p-4">
                  <p className="text-slate-200 font-semibold">Local knowledge</p>
                  <p className="mt-2">Use private datasets without exposing them.</p>
                </div>
                <div className="rounded-xl border border-white/10 p-4">
                  <p className="text-slate-200 font-semibold">Latency control</p>
                  <p className="mt-2">Keep turnaround fast for live workflows.</p>
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-amber-400/10 p-10 sm:p-14 text-center">
            <h2 className="text-3xl sm:text-4xl font-semibold">
              Ready to move from interest to activated users?
            </h2>
            <p className="mt-4 text-slate-300 max-w-2xl mx-auto">
              Start with a free workspace, connect your first channel, and let
              ConvoSpan guide the rest.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup">
                <Button className="h-auto px-8 py-4 text-base bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold">
                  Create a free account
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="outline" className="h-auto px-8 py-4 text-base border-white/15 hover:bg-white/5">
                  Compare plans
                </Button>
              </Link>
            </div>
            <div className="mt-6 text-xs text-slate-400 flex items-center justify-center gap-2">
              <ArrowRight className="h-3 w-3" />
              No credit card required to explore.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
