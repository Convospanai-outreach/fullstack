import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function GlobalCTA() {
  return (
    <div className="relative py-24 px-6 overflow-hidden bg-[#020617] border-t border-white/5 mt-12">
      <div className="pointer-events-none absolute left-[20%] top-[-10%] h-[30%] w-[30%] rounded-full bg-cyan-500/10 blur-[100px]" />
      <div className="pointer-events-none absolute right-[20%] bottom-[-10%] h-[30%] w-[30%] rounded-full bg-indigo-500/10 blur-[100px]" />
      
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <h2 className="mb-6 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
          Ready to govern your pipeline?
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-400">
          Join service teams scaling their outreach with CraftMyFunnel. Create your account to start a pilot or talk to engineering about custom workflows.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup"
            className="group relative inline-flex items-center gap-2 rounded-full bg-cyan-500 px-8 py-4 text-base font-bold text-slate-950 shadow-[0_0_40px_-10px_rgba(6,182,212,0.5)] transition-all hover:scale-105 hover:bg-cyan-400 hover:shadow-[0_0_60px_-15px_rgba(6,182,212,0.7)]"
          >
            Get Started
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 py-4 text-base font-semibold text-white transition-all hover:bg-white/10"
          >
            View Pricing
          </Link>
        </div>
      </div>
    </div>
  );
}
