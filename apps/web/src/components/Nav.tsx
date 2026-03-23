"use client";
import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LayoutDashboard, Info, HelpCircle, CreditCard } from "lucide-react";

export default function Nav() {
    const [open, setOpen] = useState(false);

    const links = [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/about", label: "Sovereignty", icon: Info },
        { href: "/faq", label: "Assistance", icon: HelpCircle },
        { href: "/pricing", label: "Membership", icon: CreditCard, mobileOnly: true },
    ];

    return (
        <div className="relative">
            <button 
                onClick={() => setOpen(!open)} 
                className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-slate-300 hover:text-white"
            >
                {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute top-16 right-0 w-64 glass-premium rounded-3xl p-4 shadow-2xl border border-white/10 z-50 overflow-hidden"
                    >
                        <div className="flex flex-col gap-2 relative z-10">
                            {links.map((link, idx) => (
                                <motion.div
                                    key={link.href}
                                    initial={{ x: 20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: idx * 0.1 }}
                                >
                                    <Link 
                                        href={link.href}
                                        onClick={() => setOpen(false)}
                                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-indigo-500/10 text-slate-400 hover:text-white transition-all group/nav"
                                    >
                                        <div className="p-2 rounded-lg bg-white/5 group-hover/nav:bg-indigo-500/20 group-hover/nav:text-indigo-400 transition-colors">
                                            <link.icon className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-bold font-outfit">{link.label}</span>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
