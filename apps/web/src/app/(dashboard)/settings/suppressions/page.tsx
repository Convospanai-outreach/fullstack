"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { getBrowserApiBase } from "@/lib/api/browserBase";
import { useTeamRole, TeamRole } from "@/hooks/useTeamRole";

const API_BASE = getBrowserApiBase();

type SuppressionEntry = {
    id: string;
    email: string;
    reason: string;
    source: string;
    createdAt: string;
};

export default function SuppressionsPage() {
    const [entries, setEntries] = useState<SuppressionEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [removing, setRemoving] = useState<string | null>(null);
    const { hasPermission } = useTeamRole();
    const canRemove = hasPermission(TeamRole.ADMIN);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/email/suppressions`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                if (!cancelled) setEntries(json.suppressions || []);
            } catch (e: any) {
                if (!cancelled) setError(e.message || "Failed to load the do-not-contact list.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const remove = async (entry: SuppressionEntry) => {
        if (!window.confirm(`Remove ${entry.email} from the do-not-contact list? Campaigns, sequences and inbox replies will be able to email them again.`)) return;
        setRemoving(entry.id);
        try {
            const res = await fetch(`${API_BASE}/email/suppressions?id=${encodeURIComponent(entry.id)}`, { method: "DELETE" });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error || `HTTP ${res.status}`);
            }
            setEntries((prev) => prev.filter((e) => e.id !== entry.id));
            toast.success(`${entry.email} can be emailed again.`);
        } catch (e: any) {
            toast.error(e.message || "Failed to remove");
        } finally {
            setRemoving(null);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mr-auto">
            <SectionHeader
                title="Do-not-contact list"
                subtitle="Addresses your team never emails: unsubscribes, bounces, complaints and leads marked Do not contact from the inbox. Only admins can remove an address, and every removal is audit-logged."
            />

            {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs p-4">
                    {error}
                </div>
            )}

            {loading && !error && <p className="text-sm text-muted-foreground">Loading...</p>}

            {!loading && !error && (
                <GlassCard className="p-6 space-y-4">
                    {entries.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nobody is on the list yet.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide">
                                        <th className="pb-2 pr-4">Email</th>
                                        <th className="pb-2 px-2">Reason</th>
                                        <th className="pb-2 px-2">Source</th>
                                        <th className="pb-2 px-2">Added</th>
                                        {canRemove && <th className="pb-2 pl-2" />}
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((entry) => (
                                        <tr key={entry.id} className="border-t border-border">
                                            <td className="py-2 pr-4 font-medium text-foreground break-all">{entry.email}</td>
                                            <td className="py-2 px-2 text-muted-foreground">{entry.reason}</td>
                                            <td className="py-2 px-2 text-muted-foreground">{entry.source}</td>
                                            <td className="py-2 px-2 text-muted-foreground">{format(new Date(entry.createdAt), "d MMM yyyy")}</td>
                                            {canRemove && (
                                                <td className="py-2 pl-2 text-right">
                                                    <Button variant="outline" size="sm" disabled={!!removing} onClick={() => remove(entry)}>
                                                        {removing === entry.id ? "Removing..." : "Remove"}
                                                    </Button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </GlassCard>
            )}
        </div>
    );
}
