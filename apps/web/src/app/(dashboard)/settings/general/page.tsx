"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
    Building2,
    CheckCircle2,
    Mail,
    MapPin,
    Settings2,
    ShieldCheck,
    UserCircle,
} from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";

function initials(name?: string | null, email?: string | null) {
    const source = name?.trim() || email?.trim() || "User";
    const parts = source.split(/\s+/).filter(Boolean);

    if (parts.length > 1 && parts[0] && parts[1]) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return source[0]?.toUpperCase() || "U";
}

export default function GeneralSettingsPage() {
    const { user, isLoaded } = useUser();
    const userName = user?.fullName || user?.primaryEmailAddress?.emailAddress?.split("@")[0] || "Workspace User";
    const userEmail = user?.primaryEmailAddress?.emailAddress || "user@workspace.com";
    const userInitials = initials(userName, userEmail);

    const [mailingAddress, setMailingAddress] = useState("");
    const [savingAddress, setSavingAddress] = useState(false);
    const [addressSaved, setAddressSaved] = useState(false);

    useEffect(() => {
        fetch("/api/settings/compliance")
            .then((res) => res.json())
            .then((data) => setMailingAddress(data?.mailingAddress || ""))
            .catch(() => {});
    }, []);

    const handleSaveAddress = async () => {
        setSavingAddress(true);
        setAddressSaved(false);
        try {
            const res = await fetch("/api/settings/compliance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mailingAddress }),
            });
            const data = await res.json();
            if (data?.ok) setAddressSaved(true);
        } catch {
            // no-op; button simply won't show the saved state
        } finally {
            setSavingAddress(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-400">
                    <Settings2 className="h-4 w-4" />
                    Workspace settings
                </div>
                <SectionHeader
                    title="General"
                    subtitle="Review your local session, workspace setup status, and the next places to finish configuration."
                />
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
                                    Active Session
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

            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-amber-500/10 p-2 text-amber-300">
                        <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-white">Mailing Address</h2>
                        <p className="text-sm text-gray-400">
                            Shown in the footer of outbound marketing emails. Required by CAN-SPAM for US-bound campaigns.
                        </p>
                    </div>
                </div>
                <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-start">
                    <textarea
                        value={mailingAddress}
                        onChange={(e) => setMailingAddress(e.target.value)}
                        placeholder="123 Main St, Suite 400, San Francisco, CA 94105, USA"
                        rows={3}
                        className="w-full flex-1 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm text-gray-200 placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none"
                    />
                    <button
                        onClick={handleSaveAddress}
                        disabled={savingAddress}
                        className="shrink-0 rounded-lg bg-brand-500/15 px-4 py-2 text-sm font-semibold text-brand-300 transition-colors hover:bg-brand-500/25 disabled:opacity-50"
                    >
                        {savingAddress ? "Saving..." : addressSaved ? "Saved" : "Save"}
                    </button>
                </div>
            </section>
        </div>
    );
}
