import Link from "next/link";
import { LogoMark } from "@/components/brand/LogoMark";
import { GlobalCTA } from "@/components/marketing/GlobalCTA";
import { montserrat } from "@/components/marketing/home/fonts";

export default function Footer({ hideCTA = false }: { hideCTA?: boolean }) {
    return (
        <>
            {!hideCTA && <GlobalCTA />}
            <footer className={`py-16 px-6 relative overflow-hidden bg-[#0c1b30] text-[#f5f5f5] ${montserrat.className}`}>
                <div className="max-w-[1280px] mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
                        <div className="col-span-2 md:col-span-1 space-y-4">
                            <Link href="/" className="flex items-center gap-2 group">
                                <LogoMark className="h-7 w-7" />
                                <span className="text-lg font-semibold tracking-tight text-white">CraftMyFunnel AI</span>
                            </Link>
                            <p className="text-sm text-[#f5f5f5]/70 leading-relaxed">
                                Governed funnel workflows for buyer signals, approved outreach, follow-ups, and qualified meeting tracking.
                            </p>
                            <a className="text-sm text-[#ffc247] underline" href="mailto:contact.us@craftmyfunnel.live">contact.us@craftmyfunnel.live</a>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#ffc247]">Product</h4>
                            <ul className="space-y-2 text-sm text-[#f5f5f5]/70">
                                <li><Link href="/products/fluid-funnel-engine" className="hover:text-white transition-colors">Fluid Funnel Engine</Link></li>
                                <li><Link href="/products/buyer-signals" className="hover:text-white transition-colors">Buyer Signals</Link></li>
                                <li><Link href="/products/ai-outreach" className="hover:text-white transition-colors">AI Outreach</Link></li>
                                <li><Link href="/products/human-layer" className="hover:text-white transition-colors">Human Layer</Link></li>
                                <li><Link href="/products/covospan-edge" className="hover:text-white transition-colors">Covospan EDGE — AI call layer</Link></li>
                                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                                <li><Link href="/industries" className="hover:text-white transition-colors">Industries</Link></li>
                                <li><Link href="/regions/india" className="hover:text-white transition-colors">India</Link></li>
                                <li><Link href="/regions/united-states" className="hover:text-white transition-colors">United States</Link></li>
                                <li><Link href="/regions/europe" className="hover:text-white transition-colors">Europe &amp; UK</Link></li>
                                <li><Link href="/vs" className="hover:text-white transition-colors">Comparisons</Link></li>
                            </ul>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#ffc247]">Resources</h4>
                            <ul className="space-y-2 text-sm text-[#f5f5f5]/70">
                                <li><Link href="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
                                <li><Link href="/help" className="hover:text-white transition-colors">Help Center</Link></li>
                                <li><Link href="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
                                <li><Link href="/support" className="hover:text-white transition-colors">Support</Link></li>
                            </ul>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#ffc247]">Legal</h4>
                            <ul className="space-y-2 text-sm text-[#f5f5f5]/70">
                                <li><Link href="/terms" className="hover:text-white transition-colors">Terms & Conditions</Link></li>
                                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
                                <li><Link href="/data-deletion" className="hover:text-white transition-colors">Data Deletion</Link></li>
                            </ul>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#ffc247]">Trust</h4>
                            <ul className="space-y-2 text-sm text-[#f5f5f5]/70">
                                <li><Link href="/security" className="hover:text-white transition-colors">Security</Link></li>
                                <li><Link href="/google-api-disclosure" className="hover:text-white transition-colors">Google API Disclosure</Link></li>
                                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-white/15 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#ffc247]" />
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#f5f5f5]/60">Governed Funnel Infrastructure</p>
                        </div>
                        <p className="text-xs font-medium text-[#f5f5f5]/60">
                            © {new Date().getFullYear()} <span className="text-slate-200">CraftMyFunnel</span>. Built for operators, not demos.
                        </p>
                    </div>
                </div>
            </footer>
        </>
    );
}
