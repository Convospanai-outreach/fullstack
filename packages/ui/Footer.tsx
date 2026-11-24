import Link from "next/link";
import { LogoMark } from "./LogoMark";
import type { ReactNode } from "react";
import { siteSans, siteSerif } from "./fonts";

export default function Footer({ siteUrl, privacyContact, cta }: { siteUrl: string; privacyContact: string; cta?: ReactNode }) {
    return (
        <>
            {cta}
            <footer className={`py-16 px-6 relative overflow-hidden bg-gradient-to-br from-[#74253A] via-[#5C1A2B] to-[#3A0E1A] text-[#F3EDE4] ${siteSans.className} ${siteSerif.variable}`}>
                <div className="max-w-[1280px] mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
                        <div className="col-span-2 md:col-span-1 space-y-4">
                            <Link href={siteUrl + "/"} className="flex items-center gap-2 group">
                                <LogoMark className="h-7 w-7" />
                                <span className="text-lg font-semibold tracking-tight text-white">CraftMyFunnel AI</span>
                            </Link>
                            <p className="text-sm text-[#F3EDE4]/70 leading-relaxed">
                                Governed funnel workflows for buyer signals, approved outreach, follow-ups, and qualified meeting tracking.
                            </p>
                            <a className="text-sm text-[#C2A36B] underline" href="mailto:contact.us@craftmyfunnel.live">contact.us@craftmyfunnel.live</a>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#C2A36B]">Product</h4>
                            <ul className="space-y-2 text-sm text-[#F3EDE4]/70">
                                <li><Link href={siteUrl + "/products/fluid-funnel-engine"} className="hover:text-white transition-colors">Fluid Funnel Engine</Link></li>
                                <li><Link href={siteUrl + "/products/buyer-signals"} className="hover:text-white transition-colors">Buyer Signals</Link></li>
                                <li><Link href={siteUrl + "/products/ai-outreach"} className="hover:text-white transition-colors">AI Outreach</Link></li>
                                <li><Link href={siteUrl + "/products/human-layer"} className="hover:text-white transition-colors">Human Layer</Link></li>
                                <li><Link href={siteUrl + "/products/covospan-edge"} className="hover:text-white transition-colors">Covospan EDGE — AI call layer</Link></li>
                                <li><Link href={siteUrl + "/pricing"} className="hover:text-white transition-colors">Pricing</Link></li>
                                <li><Link href={siteUrl + "/industries"} className="hover:text-white transition-colors">Industries</Link></li>
                                <li><Link href={siteUrl + "/regions/india"} className="hover:text-white transition-colors">India</Link></li>
                                <li><Link href={siteUrl + "/regions/united-states"} className="hover:text-white transition-colors">United States</Link></li>
                                <li><Link href={siteUrl + "/regions/europe"} className="hover:text-white transition-colors">Europe &amp; UK</Link></li>
                                <li><Link href={siteUrl + "/vs"} className="hover:text-white transition-colors">Comparisons</Link></li>
                            </ul>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#C2A36B]">Resources</h4>
                            <ul className="space-y-2 text-sm text-[#F3EDE4]/70">
                                <li><Link href={siteUrl + "/docs"} className="hover:text-white transition-colors">Documentation</Link></li>
                                <li><Link href={siteUrl + "/help"} className="hover:text-white transition-colors">Help Center</Link></li>
                                <li><Link href={siteUrl + "/faq"} className="hover:text-white transition-colors">FAQ</Link></li>
                                <li><Link href={siteUrl + "/support"} className="hover:text-white transition-colors">Support</Link></li>
                            </ul>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#C2A36B]">Legal</h4>
                            <ul className="space-y-2 text-sm text-[#F3EDE4]/70">
                                <li><Link href={siteUrl + "/terms"} className="hover:text-white transition-colors">Terms & Conditions</Link></li>
                                <li><Link href={siteUrl + "/privacy"} className="hover:text-white transition-colors">Privacy</Link></li>
                                <li><Link href={siteUrl + "/data-deletion"} className="hover:text-white transition-colors">Data Deletion</Link></li>
                            </ul>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#C2A36B]">Trust</h4>
                            <ul className="space-y-2 text-sm text-[#F3EDE4]/70">
                                <li><Link href={siteUrl + "/security"} className="hover:text-white transition-colors">Security</Link></li>
                                <li><Link href={siteUrl + "/trust/dpa"} className="hover:text-white transition-colors">Data Processing Agreement</Link></li>
                                <li><Link href={siteUrl + "/trust/subprocessors"} className="hover:text-white transition-colors">Sub-processors</Link></li>
                                <li><Link href={siteUrl + "/google-api-disclosure"} className="hover:text-white transition-colors">Google API Disclosure</Link></li>
                                <li><Link href={siteUrl + "/contact"} className="hover:text-white transition-colors">Contact</Link></li>
                                <li><a href={`mailto:${privacyContact}`} className="hover:text-white transition-colors">Privacy contact</a></li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-white/15 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#C2A36B]" />
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#F3EDE4]/60">Governed Funnel Infrastructure</p>
                        </div>
                        <p className="text-xs font-medium text-[#F3EDE4]/60">
                            © {new Date().getFullYear()} <span className="text-slate-200">CraftMyFunnel</span>. Built for operators, not demos.
                        </p>
                    </div>
                </div>
            </footer>
        </>
    );
}
