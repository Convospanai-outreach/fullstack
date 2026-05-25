"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import {
    Building2,
    CheckCircle2,
    Mail,
    Settings2,
    ShieldCheck,
    UserCircle,
} from "lucide-react";

function initials(name?: string | null, email?: string | null) {
    const source = name?.trim() || email?.trim() || "User";
    const parts = source.split(/\s+/).filter(Boolean);

    if (parts.length > 1 && parts[0] && parts[1]) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return source[0]?.toUpperCase() || "U";
}

export default function GeneralSettingsPage() {
    const { data: session, status } = useSession();
    const userName = session?.user?.name || "Workspace user";
    const userEmail = session?.user?.email || "No email on session";
    const userInitials = initials(session?.user?.name, session?.user?.email);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-400">
                    <Settings2 className="h-4 w-4" />
                    Workspace settings
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-white">General</h1>
                <p className="max-w-2xl text-sm text-gray-400">
                    Review your local session, workspace setup status, and the next places to finish configuration.
                </p>
            </div>

            <section className="grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
                    <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-lg font-bold text-brand-300">
                            {userInitials}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="truncate text-xl font-semibold text-white">{userName}</h2>
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-300">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    {status === "authenticated" ? "Signed in" : "Checking"}
                                </span>
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-sm text-gray-400">
                                <Mail className="h-4 w-4 text-gray-500" />
                                <span className="truncate">{userEmail}</span>
                            </div>
                            <p className="mt-4 max-w-xl text-sm leading-6 text-gray-400">
                                This local environment is ready for product flow testing. Real provider keys can be added later without changing the setup path.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-blue-500/10 p-2 text-blue-300">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-white">Local Mode</h2>
                            <p className="text-sm text-gray-400">Database-backed with optional integrations.</p>
                        </div>
                    </div>
                    <div className="mt-5 space-y-3 text-sm text-gray-300">
                        <div className="flex items-center justify-between border-t border-white/10 pt-3">
                            <span>Session</span>
                            <span className="text-emerald-300">Active</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-white/10 pt-3">
                            <span>Workspace</span>
                            <span className="text-emerald-300">Available</span>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
                <Link
                    href="/setup?step=3"
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-brand-500/40 hover:bg-brand-500/5"
                >
                    <Building2 className="mb-4 h-5 w-5 text-brand-300" />
                    <h3 className="font-semibold text-white">Google Workspace</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-400">Connect mailboxes, verify domain readiness, or use SMTP fallback while testing locally.</p>
                </Link>
                <Link
                    href="/settings/team"
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-brand-500/40 hover:bg-brand-500/5"
                >
                    <UserCircle className="mb-4 h-5 w-5 text-brand-300" />
                    <h3 className="font-semibold text-white">Team Access</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-400">Review members and roles before inviting teammates into this workspace.</p>
                </Link>
                <Link
                    href="/settings/budgeting"
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-brand-500/40 hover:bg-brand-500/5"
                >
                    <ShieldCheck className="mb-4 h-5 w-5 text-brand-300" />
                    <h3 className="font-semibold text-white">Usage Controls</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-400">Check credit limits and approval rules for local campaign testing.</p>
                </Link>
            </section>
        </div>
    );
}
