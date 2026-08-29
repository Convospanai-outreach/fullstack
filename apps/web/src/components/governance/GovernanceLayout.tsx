"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Shield, ClipboardList, Lock, Users, Fingerprint } from "lucide-react";

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
        <div className="space-y-8 animate-reveal">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground tracking-tight">Enterprise Governance</h1>
                <p className="text-muted-foreground mt-1">Manage workspace security, auditability, and AI safety protocols.</p>
            </div>

            <div className="flex flex-col gap-8">
                {/* Horizontal Navigation */}
                <div className="flex items-center gap-1 bg-muted p-1.5 rounded-2xl w-fit border border-border">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = pathname === tab.href;
                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                                    isActive
                                        ? "bg-primary text-white shadow-lg shadow-blue-500/20"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.name}
                            </Link>
                        );
                    })}
                </div>

                {/* Content Area */}
                <div>{children}</div>
            </div>
        </div>
    );
}
