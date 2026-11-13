"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";

// Helps with the copy of one email step. It only fills the subject and body for the operator to edit:
// nothing is sent, and each draft uses credits, so it runs only when asked.
export default function DraftWithAiPanel({
    campaignId, subject, body, onDraft,
}: {
    campaignId: string;
    subject: string;
    body: string;
    onDraft: (draft: { subject: string; body: string }) => void;
}) {
    const [instruction, setInstruction] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [note, setNote] = useState<string | null>(null);
    const hasText = !!body.trim();

    async function draft() {
        setLoading(true);
        setError(null);
        setNote(null);
        try {
            const res = await fetch(`/api/proxy/campaigns/${encodeURIComponent(campaignId)}/draft-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    instruction: instruction.trim() || undefined,
                    existingSubject: hasText ? subject.trim() || undefined : undefined,
                    existingBody: hasText ? body.slice(0, 1500) : undefined,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.status === 402) throw new Error("Not enough credits to draft this email.");
            if (!res.ok || !data.ok) throw new Error(data.error || "The draft could not be written.");
            onDraft({ subject: String(data.subject ?? ""), body: String(data.body ?? "") });
            setNote(data.reviewed === false ? "Drafted, but the automatic check did not run. Read it carefully." : "Drafted. Edit it before you save.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "The draft could not be written.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-2 rounded-md border border-border p-2.5 text-xs" aria-label="Draft with AI">
            <p className="text-muted-foreground">
                {hasText ? "Ask AI to improve this email." : "Ask AI for a first draft."} It uses the campaign brief and target audience, and uses credits.
            </p>
            <div className="flex items-center gap-2">
                <Input value={instruction} onChange={(e) => setInstruction(e.target.value)} maxLength={300} placeholder="Optional: e.g. shorter, mention the free audit" />
                <Button type="button" variant="outline" size="sm" onClick={draft} disabled={loading}>
                    {loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                    {hasText ? "Improve with AI" : "Draft with AI"}
                </Button>
            </div>
            {note && <p className="text-muted-foreground">{note}</p>}
            {error && <p className="text-amber-600 dark:text-amber-400">{error}</p>}
        </div>
    );
}
