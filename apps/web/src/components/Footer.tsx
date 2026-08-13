import Link from "next/link";
import { LogoMark } from "@/components/brand/LogoMark";

export default function Footer() {
    return (
        <footer className="mt-20 py-16 px-6 relative overflow-hidden border-t border-white/5">
            <div className="max-w-[1600px] mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
                    <div className="col-span-2 md:col-span-1 space-y-4">
                        <Link href="/" className="flex items-center gap-2 group">
                            <LogoMark className="h-7 w-7" />
                            <span className="text-lg font-black font-outfit text-white">CraftMyFunnel</span>
                        </Link>
                        <p className="text-sm text-gray-500 leading-relaxed">
                            Governed funnel workflows for buyer signals, approved outreach, follow-ups, and qualified meeting tracking.
                        </p>
                        <a className="text-sm text-cyan-300 underline" href="mailto:contact.us@craftmyfunnel.live">contact.us@craftmyfunnel.live</a>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">Product</h4>
                        <ul className="space-y-2 text-sm text-gray-500">
                            <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                            <li><Link href="/signup" className="hover:text-white transition-colors">Start pilot</Link></li>
                            <li><Link href="/login" className="hover:text-white transition-colors">Sign in</Link></li>
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">Resources</h4>
                        <ul className="space-y-2 text-sm text-gray-500">
                            <li><Link href="/help" className="hover:text-white transition-colors">Help Center</Link></li>
                            <li><Link href="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
                            <li><Link href="/support" className="hover:text-white transition-colors">Support</Link></li>
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">Legal</h4>
                        <ul className="space-y-2 text-sm text-gray-500">
                            <li><Link href="/terms" className="hover:text-white transition-colors">Terms & Conditions</Link></li>
                            <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
                            <li><Link href="/data-deletion" className="hover:text-white transition-colors">Data Deletion</Link></li>
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">Trust</h4>
                        <ul className="space-y-2 text-sm text-gray-500">
                            <li><Link href="/security" className="hover:text-white transition-colors">Security</Link></li>
                            <li><Link href="/google-api-disclosure" className="hover:text-white transition-colors">Google API Disclosure</Link></li>
                            <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-600">Governed Funnel Infrastructure</p>
                    </div>
                    <p className="text-xs font-medium text-slate-600">
                        © {new Date().getFullYear()} <span className="text-slate-400">CraftMyFunnel</span>. Built for operators, not demos.
                    </p>
                </div>
            </div>
        </footer>
    );
}
