import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, ArrowRight, Compass, MapPin, Building2, HelpCircle } from "lucide-react";

export default function NotFound() {
    return (
        <div className="min-h-[75vh] flex flex-col items-center justify-center text-center px-4 py-16">
            <div className="max-w-2xl mx-auto space-y-8">
                <div className="space-y-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                        Error 404 — Resource Not Found
                    </span>
                    <h1 className="text-7xl sm:text-8xl font-black tracking-tight text-white">
                        404
                    </h1>
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-200">
                        Page Not Found
                    </h2>
                    <p className="text-slate-400 max-w-md mx-auto text-sm sm:text-base leading-relaxed">
                        The requested page may have been moved, renamed, or is temporarily unavailable. Explore our core services or return home below.
                    </p>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-4">
                    <Link href="/">
                        <Button className="bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-2 px-6 py-2.5">
                            <Home className="w-4 h-4" />
                            <span>Return Home</span>
                        </Button>
                    </Link>
                    <Link href="/pricing">
                        <Button variant="outline" className="border-slate-700 hover:bg-slate-800 text-slate-200 flex items-center gap-2 px-6 py-2.5">
                            <span>Explore Pilot &amp; Pricing</span>
                            <ArrowRight className="w-4 h-4" />
                        </Button>
                    </Link>
                </div>

                {/* Quick Navigation Cards */}
                <div className="pt-8 border-t border-slate-800/80">
                    <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-4">
                        Quick Hub Navigation
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                        <Link
                            href="/use-cases"
                            className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition-all group"
                        >
                            <Building2 className="w-4 h-4 text-indigo-400 mb-2" />
                            <div className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">Vertical Playbooks</div>
                            <div className="text-xs text-slate-400 mt-1">Facility, Security, Staffing &amp; IT workflows.</div>
                        </Link>
                        <Link
                            href="/locations"
                            className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-blue-500/40 transition-all group"
                        >
                            <MapPin className="w-4 h-4 text-blue-400 mb-2" />
                            <div className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">Regional Hubs</div>
                            <div className="text-xs text-slate-400 mt-1">10 tech &amp; industrial commercial corridors.</div>
                        </Link>
                        <Link
                            href="/faq"
                            className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition-all group"
                        >
                            <HelpCircle className="w-4 h-4 text-emerald-400 mb-2" />
                            <div className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">Help &amp; FAQ</div>
                            <div className="text-xs text-slate-400 mt-1">Answers to common architecture questions.</div>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

