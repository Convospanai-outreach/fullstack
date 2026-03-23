"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Shield, ClipboardList, Lock, Users, Fingerprint } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";

interface GovernanceLayoutProps {
    children: React.ReactNode;
}

export default function GovernanceLayout({ children }: GovernanceLayoutProps) {
    const pathname = usePathname();

    const tabs = [
        { name: "Sovereign Firewall", href: "/governance/firewall", icon: Shield },
        { name: "Compliance Overview", href: "/governance", icon: ClipboardList },
        { name: "Audit Logs", href: "/governance/audit", icon: ClipboardList },
        { name: "Guardrail Policy", href: "/governance/guardrails", icon: Lock },
        { name: "Access Control", href: "/governance/access", icon: Users },
        { name: "Security Keys", href: "/governance/keys", icon: Fingerprint },
    ];

    return (
        <AppShell>
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white tracking-tight">Enterprise Governance</h1>
                <p className="text-text-secondary mt-1">Manage workspace security, auditability, and AI safety protocols.</p>
            </div>

            <div className="flex flex-col gap-8">
                {/* Horizontal Navigation */}
                <div className="flex items-center gap-1 bg-white/5 p-1.5 rounded-2xl w-fit border border-white/5">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = pathname === tab.href;
                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${isActive
                                    ? "bg-accent-blue text-white shadow-glow"
                                    : "text-text-secondary hover:text-white hover:bg-white/5"
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.name}
                            </Link>
                        );
                    })}
                </div>

                {/* Content Area */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
                    {children}
                </div>
            </div>
        </AppShell>
    );
}
