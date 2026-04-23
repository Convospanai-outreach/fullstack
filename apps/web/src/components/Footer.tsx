import Link from "next/link";
import { Twitter, Linkedin, Github, Sparkles } from "lucide-react";

export default function Footer() {
    return (
        <footer className="mt-20 py-16 px-6 relative overflow-hidden border-t border-white/5">
            <div className="max-w-[1600px] mx-auto">
                {/* Main Footer Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
                    {/* Brand Column */}
                    <div className="col-span-2 md:col-span-1 space-y-4">
                        <Link href="/" className="flex items-center gap-2 group">
                            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-400 to-cyan-500 flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-lg font-black font-outfit text-white">ConvoSpan</span>
                        </Link>
                        <p className="text-sm text-gray-500 leading-relaxed">
                            Email-first outbound built for teams that want control, approvals, and clear launch readiness.
                        </p>
                        <div className="flex gap-2">
                            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" title="Twitter" className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all hover:scale-110 group/social">
                                <Twitter className="w-3.5 h-3.5 text-gray-500 group-hover/social:text-white transition-colors" />
                            </a>
                            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" title="LinkedIn" className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all hover:scale-110 group/social">
                                <Linkedin className="w-3.5 h-3.5 text-gray-500 group-hover/social:text-white transition-colors" />
                            </a>
                            <a href="https://github.com" target="_blank" rel="noopener noreferrer" title="GitHub" className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all hover:scale-110 group/social">
                                <Github className="w-3.5 h-3.5 text-gray-500 group-hover/social:text-white transition-colors" />
                            </a>
                        </div>
                    </div>

                    {/* Product */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">Product</h4>
                        <ul className="space-y-2 text-sm text-gray-500">
                            <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                            <li><Link href="/signup" className="hover:text-white transition-colors">Start free</Link></li>
                            <li><Link href="/login" className="hover:text-white transition-colors">Sign in</Link></li>
                        </ul>
                    </div>

                    {/* Resources */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">Resources</h4>
                        <ul className="space-y-2 text-sm text-gray-500">
                            <li><Link href="/help" className="hover:text-white transition-colors">Help Center</Link></li>
                            <li><Link href="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
                            <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                        </ul>
                    </div>

                    {/* Company */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">Company</h4>
                        <ul className="space-y-2 text-sm text-gray-500">
                            <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
                            <li><Link href="/terms" className="hover:text-white transition-colors">Terms</Link></li>
                            <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-600">Sovereign Growth Infrastructure</p>
                    </div>
                    <p className="text-xs font-medium text-slate-600">
                        (c) {new Date().getFullYear()} <span className="text-slate-400">ConvoSpan</span>. Built for operators, not demos.
                    </p>
                </div>
            </div>
        </footer>
    );
}


