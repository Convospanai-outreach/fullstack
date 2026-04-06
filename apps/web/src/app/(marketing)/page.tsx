import Image from "next/image";
import Link from "next/link";
import { ArrowRight, LifeBuoy, Lock, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const proofPoints = [
    "Email-first launch with clear approvals and review.",
    "LinkedIn and extra channels when your team is ready.",
    "Support and trust signals visible before and after launch.",
];

const posterCards = [
    {
        title: "Signal-rich buy-in",
        copy: "See intent signals and campaign readiness in one glance.",
        image: "/images/analytics-preview.png",
    },
    {
        title: "Operator clarity",
        copy: "Setup, approvals, and launch status stay visible while you work.",
        image: "/images/workflow-preview.png",
    },
    {
        title: "Trust before checkout",
        copy: "Review controls and support remain present before you send.",
        image: "/images/dashboard-preview.png",
    },
];

export default function Home() {
    return (
        <div className="min-h-screen overflow-hidden bg-[#050d17] text-slate-100">
            <section className="relative overflow-hidden border-b border-white/10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_34%),radial-gradient(circle_at_78%_24%,rgba(52,211,153,0.18),transparent_28%),linear-gradient(180deg,rgba(5,13,23,0.96),rgba(5,13,23,1))]" />
                <div className="relative mx-auto grid max-w-7xl gap-14 px-6 py-20 lg:grid-cols-[0.95fr,1.05fr] lg:items-center lg:py-24">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-xs uppercase tracking-[0.26em] text-amber-100">
                            <Sparkles className="h-3.5 w-3.5" />
                            ConvoSpan
                        </div>
                        <h1 className="mt-7 max-w-3xl text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
                            Yes, launch outbound with more control.
                        </h1>
                        <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                            Set up email, define voice, review approvals, and launch from one workspace built for real teams.
                        </p>

                        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                            <Link href="/signup">
                                <Button className="h-auto rounded-full bg-amber-300 px-8 py-4 text-base font-semibold text-slate-950 hover:bg-amber-200">
                                    Start free
                                </Button>
                            </Link>
                            <Link href="/help">
                                <Button variant="outline" className="h-auto rounded-full border-white/15 bg-white/[0.03] px-8 py-4 text-base text-white hover:bg-white/[0.06]">
                                    Explore the help flow
                                </Button>
                            </Link>
                        </div>

                        <div className="mt-10 space-y-3">
                            {proofPoints.map((point) => (
                                <div key={point} className="flex items-start gap-3 text-sm text-slate-200 sm:text-base">
                                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-amber-300" />
                                    <span>{point}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2 rounded-[32px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_28px_120px_rgba(2,6,23,0.45)]">
                            <div className="relative aspect-[16/10] overflow-hidden rounded-[26px] border border-white/10 bg-[#09111b]">
                                <Image
                                    src="/images/dashboard-preview.png"
                                    alt="ConvoSpan workspace preview"
                                    fill
                                    priority
                                    className="object-cover"
                                />
                            </div>
                        </div>
                        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-3">
                            <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] border border-white/10 bg-[#09111b]">
                                <Image src="/images/analytics-preview.png" alt="Signal and analytics preview" fill className="object-cover" />
                            </div>
                        </div>
                        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-3">
                            <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] border border-white/10 bg-[#09111b]">
                                <Image src="/images/workflow-preview.png" alt="Workflow and approvals preview" fill className="object-cover" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="mx-auto grid max-w-7xl gap-8 px-6 py-16 lg:grid-cols-3">
                {posterCards.map((card) => (
                    <div key={card.title} className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.03]">
                        <div className="relative aspect-[5/6] border-b border-white/10">
                            <Image src={card.image} alt={card.title} fill className="object-cover" />
                        </div>
                        <div className="space-y-3 p-6">
                            <h2 className="text-2xl font-semibold text-white">{card.title}</h2>
                            <p className="text-sm leading-7 text-slate-300">{card.copy}</p>
                        </div>
                    </div>
                ))}
            </section>

            <section className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[1fr,0.9fr]">
                <div className="rounded-[32px] border border-white/10 bg-gradient-to-br from-amber-300/12 via-orange-500/10 to-transparent p-8">
                    <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-amber-100/80">
                        <LifeBuoy className="h-4 w-4" />
                        Help Before Handoff
                    </div>
                    <h2 className="mt-5 text-3xl font-semibold text-white sm:text-4xl">
                        Yes, every public and signed-in screen has a support path.
                    </h2>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                        The floating assistant answers setup, billing, imports, approvals, and API-key questions using the help
                        center, then hands off to contact support when the issue needs a human.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3">
                        <Link href="/help" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm text-white transition hover:border-amber-300/40 hover:bg-white/[0.04]">
                            Open help center
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link href="/contact" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm text-white transition hover:border-amber-300/40 hover:bg-white/[0.04]">
                            Contact support
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </div>

                <div className="grid gap-4">
                    <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6">
                        <div className="flex items-start gap-4">
                            <div className="rounded-2xl bg-amber-300/10 p-3 text-amber-200">
                                <Wand2 className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-white">Product-first walkthrough</h3>
                                <p className="mt-2 text-sm leading-7 text-slate-300">
                                    See the real workflow, approvals, and launch readiness before you create an account.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6">
                        <div className="flex items-start gap-4">
                            <div className="rounded-2xl bg-emerald-300/10 p-3 text-emerald-200">
                                <Lock className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-white">Same-origin support flows</h3>
                                <p className="mt-2 text-sm leading-7 text-slate-300">
                                    Core help and support routes stay inside the app so users focus on launch instead of setup gaps.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-6 py-16">
                <div className="rounded-[36px] border border-white/10 bg-white/[0.04] px-8 py-12 text-center">
                    <h2 className="text-3xl font-semibold text-white sm:text-4xl">Yes, start with the essentials. Add the rest when you need it.</h2>
                    <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-300">
                        Create a workspace, connect sending, import leads, and get your first campaign ready.
                    </p>
                    <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                        <Link href="/signup">
                            <Button className="h-auto rounded-full bg-amber-300 px-8 py-4 text-base font-semibold text-slate-950 hover:bg-amber-200">
                                Create a free account
                            </Button>
                        </Link>
                        <Link href="/pricing">
                            <Button variant="ghost" className="h-auto rounded-full px-8 py-4 text-base text-slate-200 hover:bg-white/[0.04] hover:text-white">
                                Compare plans
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
