"use client";

import { useEffect, useState } from "react";
import { getBrowserApiUrl } from "@/lib/api/browserBase";

interface ConnectedMailbox {
    id: string;
    email: string;
    displayName: string | null;
    provider?: string;
    status: string;
    dailyLimit: number;
    sentToday: number;
    lastSentAt: string | null;
    isWarmingUp: boolean;
}

export default function MailboxesSettingsPage() {
    const [mailboxes, setMailboxes] = useState<ConnectedMailbox[]>([]);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

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

    const statusColor = (status: string) => {
        if (status === "CONNECTED") return "text-emerald-400 bg-emerald-500/10";
        if (status === "NEEDS_RECONNECT") return "text-amber-400 bg-amber-500/10";
        return "text-zinc-400 bg-zinc-500/10";
    };

    return (
        <div className="text-slate-200">
            <div className="max-w-3xl mx-auto py-4">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white">Connected Mailboxes</h1>
                    <p className="mt-2 text-zinc-400 text-sm">
                        Connect Google Workspace, Microsoft 365, or Custom SMTP mailboxes to automate personalized cold outreach.
                    </p>
                </div>

                {success && (
                    <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-400">
                        {success}
                    </div>
                )}
                {error && (
                    <div className="mb-6 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400">
                        {error}
                    </div>
                )}

                <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Connect Google */}
                    <button
                        onClick={connectGmail}
                        disabled={connecting}
                        className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-semibold text-sm transition"
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
                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-semibold text-sm transition"
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
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : mailboxes.length === 0 ? (
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-10 text-center">
                        <div className="text-4xl mb-4">📭</div>
                        <h2 className="text-lg font-semibold text-white mb-2">No mailboxes connected</h2>
                        <p className="text-zinc-500 text-sm">
                            Connect Google Workspace, Microsoft 365, or Custom SMTP above to send cold email campaigns.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {mailboxes.map((mb) => (
                            <div key={mb.id} className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400 font-bold text-sm uppercase">
                                        {mb.email[0]}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-white font-semibold text-sm truncate">{mb.email}</p>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-300 uppercase">
                                                {mb.provider || "GOOGLE"}
                                            </span>
                                        </div>
                                        {mb.displayName && (
                                            <p className="text-zinc-500 text-xs">{mb.displayName}</p>
                                        )}
                                        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                                            <span>{mb.sentToday}/{mb.dailyLimit} sent today</span>
                                            {mb.isWarmingUp && (
                                                <span className="text-amber-400">🔥 Warming up</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold ${statusColor(mb.status)}`}>
                                        {mb.status === "CONNECTED" ? "Connected" : mb.status === "NEEDS_RECONNECT" ? "Needs Reconnect" : mb.status}
                                    </span>
                                    <button
                                        onClick={() => disconnectMailbox(mb.id)}
                                        className="text-xs text-rose-400 hover:text-rose-300 font-semibold transition"
                                    >
                                        Disconnect
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Custom SMTP Modal Dialog */}
            {showSmtpModal && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">Connect Custom SMTP Mailbox</h2>
                            <button onClick={() => setShowSmtpModal(false)} className="text-zinc-400 hover:text-white">✕</button>
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
                                <button type="button" onClick={() => setShowSmtpModal(false)} className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs">Cancel</button>
                                <button type="submit" disabled={smtpSaving} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs">
                                    {smtpSaving ? "Connecting…" : "Verify & Connect Mailbox"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
