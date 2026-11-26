"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";

type Inbox = { id: string; email: string; host: string; port: number; user: string; createdAt: string };

// Test inboxes for the inbox placement check. The check sends one copy of a customer's campaign email to each and
// reads (never opens, replies to or rescues) where it landed. Use dedicated accounts for this only.
export default function PlacementInboxesTab() {
    const [inboxes, setInboxes] = useState<Inbox[]>([]);
    const [email, setEmail] = useState("");
    const [imapHost, setImapHost] = useState("imap.gmail.com");
    const [imapPort, setImapPort] = useState("993");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");

    const load = useCallback(async () => {
        const res = await fetch("/api/superadmin/placement-inboxes");
        if (res.ok) setInboxes(((await res.json()) as { inboxes: Inbox[] }).inboxes);
    }, []);
    useEffect(() => { void load(); }, [load]);

    async function add(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        const res = await fetch("/api/superadmin/placement-inboxes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, imapHost, imapPort: Number(imapPort) || 993, password }),
        });
        const body = await res.json().catch(() => null);
        setBusy(false);
        if (!res.ok) { setMessage(body?.error || "Could not add the inbox."); return; }
        setEmail("");
        setPassword("");
        setMessage("Added. Run a placement check from a mailbox to confirm the login works.");
        void load();
    }

    async function remove(id: string) {
        if (!window.confirm("Remove this test inbox?")) return;
        const res = await fetch(`/api/superadmin/placement-inboxes/${id}`, { method: "DELETE" });
        if (res.ok) void load();
    }

    return (
        <GlassCard className="p-5 space-y-4">
            <div>
                <h3 className="text-sm font-semibold text-foreground">Inbox placement test inboxes</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                    Add 2 to 3 dedicated inboxes at different providers (for example one Gmail and one Yahoo) with IMAP turned on and an app password.
                    Make sure each inbox shows its spam folder over IMAP (in Gmail: Settings, See all settings, Labels, Spam, Show in IMAP); otherwise a copy filed as spam cannot be seen and the check reports an error.
                    Outlook.com no longer accepts app passwords over IMAP, so it cannot be used here. Do not reply to, open or move these test emails yourself.
                </p>
            </div>

            <ul className="divide-y divide-border text-xs">
                {inboxes.length === 0 && <li className="py-2 text-muted-foreground">No test inboxes yet. Placement checks stay amber until you add some.</li>}
                {inboxes.map((inbox) => (
                    <li key={inbox.id} className="flex items-center gap-3 py-2">
                        <span className="font-medium text-foreground">{inbox.email}</span>
                        <span className="text-muted-foreground">{inbox.host}:{inbox.port}</span>
                        <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => remove(inbox.id)}>Remove</Button>
                    </li>
                ))}
            </ul>

            <form onSubmit={add} className="grid gap-2 sm:grid-cols-[2fr_2fr_1fr_2fr_auto] items-end text-xs">
                <label className="space-y-1"><span className="text-muted-foreground">Email</span>
                    <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-border bg-muted px-2 py-1.5 text-foreground" />
                </label>
                <label className="space-y-1"><span className="text-muted-foreground">IMAP host</span>
                    <input required value={imapHost} onChange={(e) => setImapHost(e.target.value)} className="w-full rounded-lg border border-border bg-muted px-2 py-1.5 text-foreground" />
                </label>
                <label className="space-y-1"><span className="text-muted-foreground">Port</span>
                    <input required inputMode="numeric" value={imapPort} onChange={(e) => setImapPort(e.target.value)} className="w-full rounded-lg border border-border bg-muted px-2 py-1.5 text-foreground" />
                </label>
                <label className="space-y-1"><span className="text-muted-foreground">App password</span>
                    <input required type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-border bg-muted px-2 py-1.5 text-foreground" />
                </label>
                <Button type="submit" size="sm" disabled={busy}>{busy ? "Adding..." : "Add"}</Button>
            </form>
            {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
        </GlassCard>
    );
}
