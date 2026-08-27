"use client";

import { useEffect, useState } from "react";
import { getBrowserApiUrl } from "@/lib/api/browserBase";

interface ConnectedMailboxMetadata {
    gmailWatchExpirationAt?: string | null;
    gmailWatchRegisteredAt?: string | null;
    lastWatchError?: string | null;
    lastSyncError?: string | null;
    lastSyncErrorAt?: string | null;
}

interface ConnectedMailbox {
    id: string;
    email: string;
    displayName: string | null;
    provider?: string;
    status: string;
    dailyLimit: number;
    sentToday: number;
    minDelaySeconds?: number;
    lastSentAt: string | null;
    isWarmingUp: boolean;
    warmupDay?: number;
    warmupTargetDays?: number;
    bounceCount?: number;
    replyCount?: number;
    openCount?: number;
    clickCount?: number;
    lastSyncAt?: string | null;
    historyId?: string | null;
    tokenExpiresAt?: string | null;
    metadata?: ConnectedMailboxMetadata | null;
}

export default function MailboxesSettingsPage() {
    const [mailboxes, setMailboxes] = useState<ConnectedMailbox[]>([]);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Edit Controls Modal State
    const [editingMailbox, setEditingMailbox] = useState<ConnectedMailbox | null>(null);
    const [editDailyLimit, setEditDailyLimit] = useState(50);
    const [editMinDelay, setEditMinDelay] = useState(180);
    const [editDisplayName, setEditDisplayName] = useState("");
    const [editWarmingUp, setEditWarmingUp] = useState(true);
    const [editStatus, setEditStatus] = useState("CONNECTED");
    const [savingControls, setSavingControls] = useState(false);

    // Custom SMTP Modal State
    const [showSmtpModal, setShowSmtpModal] = useState(false);
    const [smtpHost, setSmtpHost] = useState("");
    const [smtpPort, setSmtpPort] = useState("587");
    const [smtpSecure, setSmtpSecure] = useState(false);
    const [smtpUser, setSmtpUser] = useState("");
    const [smtpPassword, setSmtpPassword] = useState("");
    const [smtpFromName, setSmtpFromName] = useState("");
    const [smtpEmail, setSmtpEmail] = useState("");
    const [smtpTestRecipient, setSmtpTestRecipient] = useState("");
    const [smtpTesting, setSmtpTesting] = useState(false);
    const [smtpTestResult, setSmtpTestResult] = useState("");
    const [smtpSaving, setSmtpSaving] = useState(false);

    // Resend Modal State
    const [showResendModal, setShowResendModal] = useState(false);
    const [resendApiKey, setResendApiKey] = useState("");
    const [resendFromName, setResendFromName] = useState("");
    const [resendEmail, setResendEmail] = useState("");
    const [resendInboundDomain, setResendInboundDomain] = useState("");
    const [resendWebhookSecret, setResendWebhookSecret] = useState("");
    const [resendShowReplyCapture, setResendShowReplyCapture] = useState(false);
    const [resendTestRecipient, setResendTestRecipient] = useState("");
    const [resendTesting, setResendTesting] = useState(false);
    const [resendTestResult, setResendTestResult] = useState("");
    const [resendSaving, setResendSaving] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (showSmtpModal) setShowSmtpModal(false);
                if (showResendModal) setShowResendModal(false);
                if (editingMailbox) setEditingMailbox(null);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [showSmtpModal, showResendModal, editingMailbox]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("connected") === "true" || params.get("googleMailbox") === "connected") {
            const provider = params.get("provider") || "Mailbox";
            setSuccess(`${provider} connected successfully!`);
            window.history.replaceState({}, "", "/settings/mailboxes");
        }
        if (params.get("error")) {
            setError(`Mailbox connection failed: ${params.get("error")}`);
            window.history.replaceState({}, "", "/settings/mailboxes");
        }
        loadMailboxes();
    }, []);

    const loadMailboxes = async () => {
        setLoading(true);
        try {
            const res = await fetch(getBrowserApiUrl("/mailboxes"));
            const data = await res.json();
            setMailboxes(data.mailboxes || []);
        } catch {
            setError("Failed to load connected mailboxes.");
        } finally {
            setLoading(false);
        }
    };

    const connectGmail = async () => {
        setConnecting(true);
        try {
            const res = await fetch(getBrowserApiUrl("/mailboxes"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nextPath: "/settings/mailboxes" }),
            });
            const data = await res.json();
            if (data.authUrl) {
                window.location.href = data.authUrl;
            } else {
                setError(data.error || "Failed to start Gmail connection.");
            }
        } catch {
            setError("Failed to start Gmail connection.");
        } finally {
            setConnecting(false);
        }
    };

    const connectMicrosoft = () => {
        window.location.href = "/api/integrations/microsoft/oauth/start";
    };

    const handleTestSmtp = async () => {
        if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword || !smtpEmail || !smtpTestRecipient) {
            setSmtpTestResult("Please fill in all SMTP fields and test recipient email.");
            return;
        }
        setSmtpTesting(true);
        setSmtpTestResult("");
        try {
            const res = await fetch("/api/integrations/smtp/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    host: smtpHost,
                    port: Number(smtpPort),
                    secure: smtpSecure,
                    user: smtpUser,
                    password: smtpPassword,
                    fromName: smtpFromName,
                    email: smtpEmail,
                    recipientEmail: smtpTestRecipient,
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setSmtpTestResult("✓ Test email sent successfully! Message-ID: " + data.messageId);
            } else {
                setSmtpTestResult("❌ Verification failed: " + (data.error || "Unknown SMTP error"));
            }
        } catch (err: any) {
            setSmtpTestResult("❌ Network error: " + (err?.message || "Failed to contact server"));
        } finally {
            setSmtpTesting(false);
        }
    };

    const handleSaveSmtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setSmtpSaving(true);
        setError("");
        try {
            const res = await fetch("/api/integrations/smtp/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    host: smtpHost,
                    port: Number(smtpPort),
                    secure: smtpSecure,
                    user: smtpUser,
                    password: smtpPassword,
                    fromName: smtpFromName,
                    email: smtpEmail,
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setSuccess(`Custom SMTP Mailbox (${data.email}) connected successfully!`);
                setShowSmtpModal(false);
                loadMailboxes();
            } else {
                setError(data.error || "Failed to connect SMTP mailbox.");
            }
        } catch {
            setError("Failed to connect SMTP mailbox.");
        } finally {
            setSmtpSaving(false);
        }
    };

    const handleTestResend = async () => {
        if (!resendApiKey || !resendEmail || !resendTestRecipient) {
            setResendTestResult("Please fill in the API key, sender email, and test recipient email.");
            return;
        }
        setResendTesting(true);
        setResendTestResult("");
        try {
            const res = await fetch("/api/integrations/resend/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    apiKey: resendApiKey,
                    fromName: resendFromName,
                    email: resendEmail,
                    recipientEmail: resendTestRecipient,
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setResendTestResult("✓ Test email sent successfully! Message-ID: " + data.messageId);
            } else {
                setResendTestResult("❌ Verification failed: " + (data.error || "Unknown Resend error"));
            }
        } catch (err: any) {
            setResendTestResult("❌ Network error: " + (err?.message || "Failed to contact server"));
        } finally {
            setResendTesting(false);
        }
    };

    const handleSaveResend = async (e: React.FormEvent) => {
        e.preventDefault();
        setResendSaving(true);
        setError("");
        try {
            const res = await fetch("/api/integrations/resend/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    apiKey: resendApiKey,
                    fromName: resendFromName,
                    email: resendEmail,
                    inboundDomain: resendInboundDomain || undefined,
                    webhookSecret: resendWebhookSecret || undefined,
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setSuccess(`Resend Mailbox (${data.email}) connected successfully!`);
                setShowResendModal(false);
                loadMailboxes();
            } else {
                setError(data.error || "Failed to connect Resend mailbox.");
            }
        } catch {
            setError("Failed to connect Resend mailbox.");
        } finally {
            setResendSaving(false);
        }
    };

    const openEditModal = (mb: ConnectedMailbox) => {
        setEditingMailbox(mb);
        setEditDailyLimit(mb.dailyLimit || 50);
        setEditMinDelay(mb.minDelaySeconds || 180);
        setEditDisplayName(mb.displayName || "");
        setEditWarmingUp(mb.isWarmingUp);
        setEditStatus(mb.status);
    };

    const handleSaveControls = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMailbox) return;
        setSavingControls(true);
        try {
            const res = await fetch(getBrowserApiUrl("/mailboxes"), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mailboxId: editingMailbox.id,
                    dailyLimit: Number(editDailyLimit),
                    minDelaySeconds: Number(editMinDelay),
                    displayName: editDisplayName || null,
                    isWarmingUp: editWarmingUp,
                    status: editStatus,
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setSuccess(`Controls updated for ${editingMailbox.email}`);
                setEditingMailbox(null);
                loadMailboxes();
            } else {
                setError(data.error || "Failed to update mailbox controls.");
            }
        } catch {
            setError("Failed to update mailbox controls.");
        } finally {
            setSavingControls(false);
        }
    };

    const disconnectMailbox = async (mailboxId: string) => {
        if (!confirm("Disconnect this mailbox? Outreach for this account will stop.")) return;
        try {
            await fetch(getBrowserApiUrl("/mailboxes"), {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mailboxId }),
            });
            loadMailboxes();
        } catch {
            setError("Failed to disconnect mailbox.");
        }
    };

    const statusBadge = (mb: ConnectedMailbox) => {
        if (mb.status === "CONNECTED") {
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">● Active</span>;
        }
        if (mb.status === "NEEDS_RECONNECT") {
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20">⚠️ Reconnect</span>;
        }
        if (mb.status === "PAUSED") {
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20">⏸ Paused</span>;
        }
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-zinc-400 bg-zinc-500/10 border border-zinc-500/20">{mb.status}</span>;
    };

    const formatTimeRemaining = (dateStr?: string | null) => {
        if (!dateStr) return null;
        const target = new Date(dateStr).getTime();
        const diff = target - Date.now();
        if (diff <= 0) return "Expired";
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours > 48) return `${Math.floor(hours / 24)} days`;
        if (hours > 0) return `${hours} hrs`;
        return `${Math.floor(diff / (1000 * 60))} mins`;
    };

    return (
        <div className="text-slate-200">
            <div className="max-w-4xl mx-auto py-6">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white tracking-tight">Connected Mailboxes & Observability</h1>
                    <p className="mt-2 text-zinc-400 text-sm">
                        Manage send capacity, throttle rates, OAuth token health, and Pub/Sub push watch synchronization.
                    </p>
                </div>

                {success && (
                    <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-400 flex items-center justify-between">
                        <span>{success}</span>
                        <button onClick={() => setSuccess("")} className="text-xs text-emerald-300 hover:underline">Dismiss</button>
                    </div>
                )}
                {error && (
                    <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400 flex items-center justify-between">
                        <span>{error}</span>
                        <button onClick={() => setError("")} className="text-xs text-rose-300 hover:underline">Dismiss</button>
                    </div>
                )}

                <div className="mb-8 grid grid-cols-1 sm:grid-cols-4 gap-3">
                    {/* Connect Google */}
                    <button
                        onClick={connectGmail}
                        disabled={connecting}
                        className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-semibold text-sm transition shadow-lg shadow-indigo-600/20"
                    >
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.64 12.2c0-.638-.057-1.252-.164-1.84H12v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.616Z" />
                            <path d="M12 21c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H3.957v2.332A8.997 8.997 0 0 0 12 21Z" />
                            <path d="M6.964 13.71a5.41 5.41 0 0 1-.282-1.71c0-.593.102-1.17.282-1.71V7.958H3.957A8.996 8.996 0 0 0 3 12c0 1.452.348 2.827.957 4.042l3.007-2.332Z" />
                            <path d="M12 6.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C16.463 3.891 14.426 3 12 3a8.997 8.997 0 0 0-8.043 4.958l3.007 2.332C7.672 8.163 9.656 6.58 12 6.58Z" />
                        </svg>
                        Google Workspace
                    </button>

                    {/* Connect Microsoft */}
                    <button
                        onClick={connectMicrosoft}
                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-semibold text-sm transition shadow-lg shadow-blue-600/20"
                    >
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 23 23" fill="currentColor">
                            <path d="M0 0h11v11H0zM12 0h11v11H12zM0 12h11v11H0zM12 12h11v11H12z" />
                        </svg>
                        Microsoft 365
                    </button>

                    {/* Connect SMTP */}
                    <button
                        onClick={() => setShowSmtpModal(true)}
                        className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-3 rounded-xl font-semibold text-sm border border-white/10 transition"
                    >
                        ⚡ Custom SMTP
                    </button>

                    {/* Connect Resend */}
                    <button
                        onClick={() => setShowResendModal(true)}
                        className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-3 rounded-xl font-semibold text-sm border border-white/10 transition"
                    >
                        ✉️ Resend
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : mailboxes.length === 0 ? (
                    <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-12 text-center">
                        <div className="text-5xl mb-4">📭</div>
                        <h2 className="text-xl font-semibold text-white mb-2">No mailboxes connected</h2>
                        <p className="text-zinc-400 text-sm max-w-md mx-auto">
                            Connect Google Workspace, Microsoft 365, or Custom SMTP to unlock automated cold outreach and reply tracking.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {mailboxes.map((mb) => {
                            const pct = Math.min(100, Math.round((mb.sentToday / (mb.dailyLimit || 1)) * 100));
                            const tokenTime = formatTimeRemaining(mb.tokenExpiresAt);
                            const watchTime = formatTimeRemaining(mb.metadata?.gmailWatchExpirationAt);
                            const hasError = mb.metadata?.lastWatchError || mb.metadata?.lastSyncError;

                            return (
                                <div key={mb.id} className="bg-zinc-900/80 border border-white/10 rounded-2xl p-5 space-y-4 transition hover:border-white/20">
                                    {/* Main Row */}
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3.5 min-w-0">
                                            <div className="shrink-0 w-11 h-11 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-base uppercase mt-0.5">
                                                {mb.email[0]}
                                            </div>
                                            <div className="min-w-0 space-y-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-white font-bold text-base truncate">{mb.email}</p>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-zinc-300 uppercase tracking-wider">
                                                        {mb.provider || "GOOGLE"}
                                                    </span>
                                                    {statusBadge(mb)}
                                                </div>
                                                {mb.displayName && (
                                                    <p className="text-zinc-400 text-xs">{mb.displayName}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {mb.status === "NEEDS_RECONNECT" && (
                                                <button
                                                    onClick={connectGmail}
                                                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition shadow"
                                                >
                                                    Reconnect
                                                </button>
                                            )}
                                            <button
                                                onClick={() => openEditModal(mb)}
                                                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs border border-white/10 transition"
                                            >
                                                ⚙️ Controls
                                            </button>
                                            <button
                                                onClick={() => disconnectMailbox(mb.id)}
                                                className="px-3 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 font-semibold text-xs transition"
                                            >
                                                Disconnect
                                            </button>
                                        </div>
                                    </div>

                                    {/* Daily Send Capacity & Throttle Progress */}
                                    <div className="bg-zinc-950/60 rounded-xl p-3.5 border border-white/5 space-y-2 text-xs">
                                        <div className="flex items-center justify-between text-zinc-300">
                                            <span className="font-medium flex items-center gap-1.5">
                                                <span>📊 Daily Volume</span>
                                                <span className="text-zinc-500">({mb.sentToday} / {mb.dailyLimit} sent)</span>
                                            </span>
                                            <span className="text-zinc-400">
                                                Min Delay: <strong className="text-white">{mb.minDelaySeconds || 180}s</strong>
                                            </span>
                                        </div>
                                        <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-500 ${pct >= 90 ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-indigo-500"}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] text-zinc-500">
                                            <span>{pct}% quota used today</span>
                                            <span>Last sent: {mb.lastSentAt ? new Date(mb.lastSentAt).toLocaleTimeString() : "Never"}</span>
                                        </div>
                                    </div>

                                    {/* Observability & Health Grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                        {/* OAuth Token Expiry */}
                                        <div className="bg-zinc-950/40 rounded-lg p-2.5 border border-white/5">
                                            <span className="text-zinc-500 block text-[10px] uppercase font-semibold">OAuth Token</span>
                                            <span className="text-zinc-200 font-medium truncate block mt-0.5">
                                                {tokenTime ? (tokenTime === "Expired" ? "❌ Expired" : `🔑 ${tokenTime} left`) : "Active"}
                                            </span>
                                        </div>

                                        {/* Gmail Watch Expiration */}
                                        <div className="bg-zinc-950/40 rounded-lg p-2.5 border border-white/5">
                                            <span className="text-zinc-500 block text-[10px] uppercase font-semibold">Pub/Sub Watch</span>
                                            <span className="text-zinc-200 font-medium truncate block mt-0.5">
                                                {watchTime ? (watchTime === "Expired" ? "⚠️ Watch Due" : `📡 ${watchTime}`) : "Active"}
                                            </span>
                                        </div>

                                        {/* Warmup Status */}
                                        <div className="bg-zinc-950/40 rounded-lg p-2.5 border border-white/5">
                                            <span className="text-zinc-500 block text-[10px] uppercase font-semibold">Warmup State</span>
                                            <span className="text-zinc-200 font-medium truncate block mt-0.5">
                                                {mb.isWarmingUp ? `🔥 Day ${mb.warmupDay || 0}/${mb.warmupTargetDays || 30}` : "✅ Warmed Up"}
                                            </span>
                                        </div>

                                        {/* History Cursor */}
                                        <div className="bg-zinc-950/40 rounded-lg p-2.5 border border-white/5">
                                            <span className="text-zinc-500 block text-[10px] uppercase font-semibold">History Cursor</span>
                                            <span className="text-zinc-200 font-medium truncate block mt-0.5 font-mono text-[11px]">
                                                {mb.historyId ? `#${mb.historyId}` : "Not synced"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Engagement Stats Row */}
                                    <div className="flex items-center gap-4 text-xs text-zinc-400 pt-1 border-t border-white/5">
                                        <span>📨 <strong className="text-white">{mb.replyCount || 0}</strong> replies</span>
                                        <span>👁️ <strong className="text-white">{mb.openCount || 0}</strong> opens</span>
                                        <span>🎯 <strong className="text-white">{mb.clickCount || 0}</strong> clicks</span>
                                        <span className="text-rose-400">🚨 <strong>{mb.bounceCount || 0}</strong> bounces</span>
                                        {mb.lastSyncAt && (
                                            <span className="ml-auto text-zinc-500 text-[11px]">
                                                Synced {new Date(mb.lastSyncAt).toLocaleTimeString()}
                                            </span>
                                        )}
                                    </div>

                                    {/* Error Banner if any */}
                                    {hasError && (
                                        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-400 flex items-center gap-2">
                                            <span>⚠️</span>
                                            <span>Sync Error: {mb.metadata?.lastWatchError || mb.metadata?.lastSyncError}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Mailbox Edit Controls Modal */}
            {editingMailbox && (
                <div role="dialog" aria-modal="true" aria-labelledby="controls-modal-title" className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <h2 id="controls-modal-title" className="text-lg font-bold text-white">Mailbox Controls — {editingMailbox.email}</h2>
                            <button onClick={() => setEditingMailbox(null)} aria-label="Close dialog" className="text-zinc-400 hover:text-white">✕</button>
                        </div>
                        <form onSubmit={handleSaveControls} className="space-y-4 text-sm">
                            <div>
                                <label className="block text-zinc-400 text-xs mb-1">From Display Name</label>
                                <input
                                    type="text"
                                    value={editDisplayName}
                                    onChange={(e) => setEditDisplayName(e.target.value)}
                                    placeholder="e.g. John from Sales"
                                    className="w-full bg-zinc-800 border border-white/10 rounded-lg p-2.5 text-white"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-zinc-400 text-xs mb-1">Daily Limit (1 - 2000)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={2000}
                                        value={editDailyLimit}
                                        onChange={(e) => setEditDailyLimit(Number(e.target.value))}
                                        required
                                        className="w-full bg-zinc-800 border border-white/10 rounded-lg p-2.5 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-zinc-400 text-xs mb-1">Min Send Delay (Sec)</label>
                                    <input
                                        type="number"
                                        min={30}
                                        max={86400}
                                        value={editMinDelay}
                                        onChange={(e) => setEditMinDelay(Number(e.target.value))}
                                        required
                                        className="w-full bg-zinc-800 border border-white/10 rounded-lg p-2.5 text-white"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 pt-2 border-t border-white/10">
                                <label className="block text-zinc-400 text-xs">Mailbox Status</label>
                                <select
                                    value={editStatus}
                                    onChange={(e) => setEditStatus(e.target.value)}
                                    className="w-full bg-zinc-800 border border-white/10 rounded-lg p-2.5 text-white"
                                >
                                    <option value="CONNECTED">CONNECTED — Active Sending</option>
                                    <option value="PAUSED">PAUSED — Pause Outreach</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="isWarmingUp"
                                    checked={editWarmingUp}
                                    onChange={(e) => setEditWarmingUp(e.target.checked)}
                                    className="rounded bg-zinc-800 border-white/20"
                                />
                                <label htmlFor="isWarmingUp" className="text-zinc-300 text-xs">
                                    Enable Warmup Schedule (Gradual Daily Limit Scaling)
                                </label>
                            </div>

                            <div className="pt-3 flex justify-end gap-2 border-t border-white/10">
                                <button type="button" onClick={() => setEditingMailbox(null)} className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold">
                                    Cancel
                                </button>
                                <button type="submit" disabled={savingControls} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs">
                                    {savingControls ? "Saving…" : "Save Controls"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Custom SMTP Modal Dialog */}
            {showSmtpModal && (
                <div role="dialog" aria-modal="true" aria-labelledby="smtp-modal-title" className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <h2 id="smtp-modal-title" className="text-xl font-bold text-white">Connect Custom SMTP Mailbox</h2>
                            <button onClick={() => setShowSmtpModal(false)} aria-label="Close dialog" className="text-zinc-400 hover:text-white">✕</button>
                        </div>
                        <form onSubmit={handleSaveSmtp} className="space-y-3 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-zinc-400 text-xs mb-1">SMTP Host</label>
                                    <input type="text" placeholder="smtp.domain.com" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} required className="w-full bg-zinc-800 border border-white/10 rounded-lg p-2 text-white" />
                                </div>
                                <div>
                                    <label className="block text-zinc-400 text-xs mb-1">Port</label>
                                    <input type="number" placeholder="587" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} required className="w-full bg-zinc-800 border border-white/10 rounded-lg p-2 text-white" />
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="secure" checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} className="rounded bg-zinc-800" />
                                <label htmlFor="secure" className="text-zinc-300 text-xs">Use SSL/TLS (Port 465)</label>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-zinc-400 text-xs mb-1">Username / Auth Email</label>
                                    <input type="text" placeholder="user@domain.com" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} required className="w-full bg-zinc-800 border border-white/10 rounded-lg p-2 text-white" />
                                </div>
                                <div>
                                    <label className="block text-zinc-400 text-xs mb-1">Password</label>
                                    <input type="password" placeholder="••••••••" value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} required className="w-full bg-zinc-800 border border-white/10 rounded-lg p-2 text-white" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-zinc-400 text-xs mb-1">From Display Name</label>
                                    <input type="text" placeholder="John Doe" value={smtpFromName} onChange={(e) => setSmtpFromName(e.target.value)} required className="w-full bg-zinc-800 border border-white/10 rounded-lg p-2 text-white" />
                                </div>
                                <div>
                                    <label className="block text-zinc-400 text-xs mb-1">From Sender Email</label>
                                    <input type="email" placeholder="john@domain.com" value={smtpEmail} onChange={(e) => setSmtpEmail(e.target.value)} required className="w-full bg-zinc-800 border border-white/10 rounded-lg p-2 text-white" />
                                </div>
                            </div>

                            <div className="pt-2 border-t border-white/10">
                                <label className="block text-zinc-400 text-xs mb-1">Send Verification Test Email To:</label>
                                <div className="flex gap-2">
                                    <input type="email" placeholder="mytest@domain.com" value={smtpTestRecipient} onChange={(e) => setSmtpTestRecipient(e.target.value)} className="w-full bg-zinc-800 border border-white/10 rounded-lg p-2 text-white text-xs" />
                                    <button type="button" onClick={handleTestSmtp} disabled={smtpTesting} className="bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg text-white font-semibold text-xs shrink-0">
                                        {smtpTesting ? "Testing…" : "Send Test"}
                                    </button>
                                </div>
                                {smtpTestResult && (
                                    <p className={`mt-1 text-xs ${smtpTestResult.startsWith("✓") ? "text-emerald-400" : "text-rose-400"}`}>{smtpTestResult}</p>
                                )}
                            </div>

                            <div className="pt-3 flex justify-end gap-2">
                                <button type="button" onClick={() => setShowSmtpModal(false)} className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold">Cancel</button>
                                <button type="submit" disabled={smtpSaving} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs">
                                    {smtpSaving ? "Connecting…" : "Verify & Connect Mailbox"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Resend Modal Dialog */}
            {showResendModal && (
                <div role="dialog" aria-modal="true" aria-labelledby="resend-modal-title" className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <h2 id="resend-modal-title" className="text-xl font-bold text-white">Connect Resend Mailbox</h2>
                            <button onClick={() => setShowResendModal(false)} aria-label="Close dialog" className="text-zinc-400 hover:text-white">✕</button>
                        </div>
                        <form onSubmit={handleSaveResend} className="space-y-3 text-sm">
                            <div>
                                <label className="block text-zinc-400 text-xs mb-1">Resend API Key</label>
                                <input type="password" placeholder="re_xxxxxxxxxxxx" value={resendApiKey} onChange={(e) => setResendApiKey(e.target.value)} required className="w-full bg-zinc-800 border border-white/10 rounded-lg p-2 text-white" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-zinc-400 text-xs mb-1">From Display Name</label>
                                    <input type="text" placeholder="John Doe" value={resendFromName} onChange={(e) => setResendFromName(e.target.value)} required className="w-full bg-zinc-800 border border-white/10 rounded-lg p-2 text-white" />
                                </div>
                                <div>
                                    <label className="block text-zinc-400 text-xs mb-1">From Sender Email (verified domain)</label>
                                    <input type="email" placeholder="john@domain.com" value={resendEmail} onChange={(e) => setResendEmail(e.target.value)} required className="w-full bg-zinc-800 border border-white/10 rounded-lg p-2 text-white" />
                                </div>
                            </div>

                            <div className="pt-2 border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setResendShowReplyCapture((v) => !v)}
                                    className="flex items-center justify-between w-full text-left text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                                >
                                    <span>⚙️ Reply Capture (optional, advanced)</span>
                                    <span>{resendShowReplyCapture ? "▲" : "▼"}</span>
                                </button>
                                {resendShowReplyCapture && (
                                    <div className="mt-2 space-y-3 bg-zinc-950/60 border border-white/5 rounded-lg p-3">
                                        <p className="text-[11px] text-zinc-500 leading-relaxed">
                                            Resend doesn't have an inbox, so detecting a prospect's reply requires your own dedicated receiving domain. In <strong>your own</strong> Resend dashboard: (1) verify a subdomain you control for receiving (e.g. <code>reply.yourdomain.com</code>) and add the MX record Resend gives you — never reuse a domain you also send real mail from; (2) create a webhook for the <code>email.received</code> event pointed at <code>{typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/resend</code>; (3) paste that webhook's signing secret below. Until both fields are filled in, replies to this mailbox won't be detected.
                                        </p>
                                        <div>
                                            <label className="block text-zinc-400 text-xs mb-1">Your Verified Inbound Domain</label>
                                            <input type="text" placeholder="reply.yourdomain.com" value={resendInboundDomain} onChange={(e) => setResendInboundDomain(e.target.value)} className="w-full bg-zinc-800 border border-white/10 rounded-lg p-2 text-white text-xs" />
                                        </div>
                                        <div>
                                            <label className="block text-zinc-400 text-xs mb-1">Your Webhook Signing Secret</label>
                                            <input type="password" placeholder="whsec_xxxxxxxxxxxx" value={resendWebhookSecret} onChange={(e) => setResendWebhookSecret(e.target.value)} className="w-full bg-zinc-800 border border-white/10 rounded-lg p-2 text-white text-xs" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-2 border-t border-white/10">
                                <label className="block text-zinc-400 text-xs mb-1">Send Verification Test Email To:</label>
                                <div className="flex gap-2">
                                    <input type="email" placeholder="mytest@domain.com" value={resendTestRecipient} onChange={(e) => setResendTestRecipient(e.target.value)} className="w-full bg-zinc-800 border border-white/10 rounded-lg p-2 text-white text-xs" />
                                    <button type="button" onClick={handleTestResend} disabled={resendTesting} className="bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg text-white font-semibold text-xs shrink-0">
                                        {resendTesting ? "Testing…" : "Send Test"}
                                    </button>
                                </div>
                                {resendTestResult && (
                                    <p className={`mt-1 text-xs ${resendTestResult.startsWith("✓") ? "text-emerald-400" : "text-rose-400"}`}>{resendTestResult}</p>
                                )}
                            </div>

                            <div className="pt-3 flex justify-end gap-2">
                                <button type="button" onClick={() => setShowResendModal(false)} className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold">Cancel</button>
                                <button type="submit" disabled={resendSaving} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs">
                                    {resendSaving ? "Connecting…" : "Verify & Connect Mailbox"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
