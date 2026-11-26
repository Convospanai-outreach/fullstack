"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";

type Team = { id: string; name: string; sent: number; bounced: number; complained: number; delayed: number; failed: number; incidents: number; held: boolean };
const rate = (events: number, sends: number) => sends ? (100 * events / sends).toFixed(2) + "%" : "—";

export default function SendingTab({ onLoggedOut }: { onLoggedOut: () => void }) {
    const [teams, setTeams] = useState<Team[] | null>(null);
    const [selected, setSelected] = useState<Team | null>(null);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    useEffect(() => {
        const controller = new AbortController();
        fetch("/api/superadmin/sending", { signal: controller.signal, cache: "no-store" }).then(async (response) => {
            if (response.status === 401) return onLoggedOut();
            if (!response.ok) throw new Error("Could not load sending data.");
            const data = await response.json();
            if (!controller.signal.aborted) setTeams(data.teams);
        }).catch(() => { if (!controller.signal.aborted) setError("Could not load sending data."); });
        return () => controller.abort();
    }, [onLoggedOut]);

    async function save() {
        if (!selected) return;
        setBusy(true);
        setError("");
        try {
            const response = await fetch("/api/superadmin/sending", {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId: selected.id, held: !selected.held, reason }),
            });
            if (response.status === 401) return onLoggedOut();
            if (!response.ok) throw new Error("Could not update the sending hold.");
            const { held } = await response.json();
            setTeams((current) => current?.map((team) => team.id === selected.id ? { ...team, held } : team) ?? null);
            setSelected(null);
            setReason("");
        } catch {
            setError("Could not update the sending hold.");
        } finally {
            setBusy(false);
        }
    }

    return <GlassCard className="p-5 space-y-4">
        <h2 className="font-semibold">Team sending over seven days</h2>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!teams && !error && <p className="text-sm text-muted-foreground">Loading sending data…</p>}
        {teams && <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b border-border">
                {["Team", "Sends", "Bounce", "Complaint", "Delayed", "Failed", "Open incidents", "Sending hold"].map((heading) => <th key={heading} scope="col" className="p-2 text-left">{heading}</th>)}
            </tr></thead>
            <tbody>{teams.map((team) => <tr key={team.id} className="border-b border-border">
                <th scope="row" className="p-2 text-left">{team.name}</th>
                <td className="p-2">{team.sent}</td><td className="p-2">{rate(team.bounced, team.sent)}</td>
                <td className="p-2">{rate(team.complained, team.sent)}</td><td className="p-2">{rate(team.delayed, team.sent)}</td>
                <td className="p-2">{rate(team.failed, team.sent)}</td><td className="p-2">{team.incidents}</td>
                <td className="p-2"><Button variant="outline" size="sm" disabled={busy} onClick={() => { setSelected(team); setReason(""); }}>{team.held ? "Release hold" : "Hold all team sending"}</Button></td>
            </tr>)}</tbody>
        </table></div>}
        {selected && <div className="space-y-3 rounded border border-border p-3 text-sm">
            <p>{selected.held ? "Release the sending hold for " : "Hold all sending for "}{selected.name}.</p>
            <label className="block space-y-1"><span className="block">Reason</span><input value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} className="w-full rounded border border-input bg-background p-2" /></label>
            <div className="flex gap-2"><Button disabled={busy || !reason.trim()} onClick={() => void save()}>Confirm</Button><Button variant="outline" disabled={busy} onClick={() => setSelected(null)}>Cancel</Button></div>
        </div>}
    </GlassCard>;
}
