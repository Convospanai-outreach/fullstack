import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, ArrowRight, Compass, MapPin, Building2, HelpCircle } from "lucide-react";

export default function NotFound() {
    return (
        <div className="min-h-[75vh] flex flex-col items-center justify-center text-center px-4 py-16">
            <div className="max-w-2xl mx-auto space-y-8">
                <div className="space-y-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-[#5C1A2B] px-3 py-1 rounded-full bg-[#C2A36B]/30 border border-[#1A1414]/10">
                        Error 404 — Resource Not Found
                    </span>
                    <h1 className="text-7xl sm:text-8xl font-semibold tracking-tight text-[#1A1414]">
                        404
                    </h1>
                    <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1414]/85">
                        Page Not Found
                    </h2>
                    <p className="text-[#1A1414]/65 max-w-md mx-auto text-sm sm:text-base leading-relaxed">
                        The requested page may have been moved, renamed, or is temporarily unavailable. Explore our core services or return home below.
                    </p>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-4">
                    <Link href="/">
                        <Button className="bg-primary hover:bg-primary text-[#1A1414] font-semibold flex items-center gap-2 px-6 py-2.5">
                            <Home className="w-4 h-4" />
                            <span>Return Home</span>
                        </Button>
                    </Link>
                    <Link href="/pricing">
                        <Button variant="outline" className="border-[#1A1414]/15 hover:bg-[#E8DFD2] text-[#1A1414]/85 flex items-center gap-2 px-6 py-2.5">
                            <span>Explore Pilot &amp; Pricing</span>
                            <ArrowRight className="w-4 h-4" />
                        </Button>
                    </Link>
                </div>

                {/* Quick Navigation Cards */}
                <div className="pt-8 border-t border-[#1A1414]/10/80">
                    <p className="text-xs uppercase tracking-wider text-[#1A1414]/65 font-semibold mb-4">
                        Quick Hub Navigation
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                        <Link
                            href="/industries"
                            className="p-4 rounded-xl bg-card border border-[#1A1414]/10 hover:border-[#5C1A2B] transition-all group"
                        >
                            <Building2 className="w-4 h-4 text-[#5C1A2B] mb-2" />
                            <div className="text-sm font-bold text-[#1A1414] group-hover:text-[#5C1A2B] transition-colors">Vertical Playbooks</div>
                            <div className="text-xs text-[#1A1414]/65 mt-1">Facility, Security, Staffing &amp; IT workflows.</div>
                        </Link>
                        <Link
                            href="/locations"
                            className="p-4 rounded-xl bg-card border border-[#1A1414]/10 hover:border-primary/40 transition-all group"
                        >
                            <MapPin className="w-4 h-4 text-primary mb-2" />
                            <div className="text-sm font-bold text-[#1A1414] group-hover:text-primary transition-colors">Regional Hubs</div>
                            <div className="text-xs text-[#1A1414]/65 mt-1">10 tech &amp; industrial commercial corridors.</div>
                        </Link>
                        <Link
                            href="/faq"
                            className="p-4 rounded-xl bg-card border border-[#1A1414]/10 hover:border-success/40 transition-all group"
                        >
                            <HelpCircle className="w-4 h-4 text-[#5C1A2B] mb-2" />
                            <div className="text-sm font-bold text-[#1A1414] group-hover:text-[#5C1A2B] transition-colors">Help &amp; FAQ</div>
                            <div className="text-xs text-[#1A1414]/65 mt-1">Answers to common architecture questions.</div>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

