"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DraftScore {
    strategyId: string;
    name: string;
    score: number;
    viable?: boolean;
    notes: string[];
}

// Scores the email being written against the campaign's conversion strategies (S7, S8, S12). It runs
// only when asked, because each score is a paid call, and it only advises.
export default function DraftScorePanel({ campaignId, subject, body }: { campaignId: string; subject: string; body: string }) {
    const [scores, setScores] = useState<DraftScore[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function score() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/proxy/campaigns/${encodeURIComponent(campaignId)}/score-draft`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subject: subject.trim() || undefined, body }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) throw new Error(data.error || "The draft could not be scored.");
            setScores(data.scores as DraftScore[]);
        } catch (err) {
            setScores(null);
            setError(err instanceof Error ? err.message : "The draft could not be scored.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-2 rounded-md border border-border p-2.5 text-xs" aria-label="Draft score">
            <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground">Score this draft against the campaign&apos;s conversion strategies.</p>
                <Button type="button" variant="outline" size="sm" onClick={score} disabled={loading || !body.trim()}>
                    {loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                    Score this draft
                </Button>
            </div>
            {error && <p className="text-amber-600 dark:text-amber-400">{error}</p>}
            {scores?.map((s) => (
                <div key={s.strategyId}>
                    <p className="font-semibold">
                        {s.name}: {s.score}
                        {s.viable === undefined ? "" : s.viable ? " - viable" : " - below the pass mark"}
                    </p>
                    {s.notes.map((note) => <p key={note} className="mt-0.5 text-muted-foreground">{note}</p>)}
                </div>
            ))}
        </div>
    );
}
