"use client";

import { useState } from "react";

// Shown when the editor is open on unpublished edits to a live page. The live page keeps
// serving its last publish until the user publishes again or discards these edits.
export default function UnpublishedChangesBanner({ onDiscard }: { onDiscard: () => Promise<void> }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function discard() {
        if (!window.confirm("Discard your unpublished changes? The live page stays as it was last published.")) return;
        setBusy(true);
        setError(null);
        try {
            await onDiscard();
        } catch (err: any) {
            setError(err?.message || "Could not discard the changes. Try again.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p>
                You have unpublished changes. The live page keeps showing the last published version until you publish.
            </p>
            <div className="flex items-center gap-3">
                {error ? <span className="text-destructive">{error}</span> : null}
                <button
                    type="button"
                    onClick={discard}
                    disabled={busy}
                    className="rounded-md border border-amber-400 px-3 py-1.5 font-medium hover:bg-amber-100 disabled:opacity-50"
                >
                    {busy ? "Discarding..." : "Discard changes"}
                </button>
            </div>
        </div>
    );
}
