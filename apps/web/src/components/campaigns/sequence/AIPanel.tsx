"use client";

import { useState } from "react";
import { Sparkles, Send } from "lucide-react";

const SUGGESTIONS = [
    "Suggest me some ideas of campaigns",
    "Build a multichannel outreach sequence from scratch",
    "Audit my sequence and suggest improvements",
    "Write the messages for my steps",
    "Complete my sequence with the missing steps",
    "Help me fix the errors on my sequence",
];

export default function AIPanel() {
    const [prompt, setPrompt] = useState("");

    return (
        <div className="flex h-full w-[340px] shrink-0 flex-col rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border p-4">
                <Sparkles className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-semibold">Sequence assistant</h3>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {SUGGESTIONS.map((suggestion) => (
                    <button
                        key={suggestion}
                        type="button"
                        onClick={() => setPrompt(suggestion)}
                        className="w-full rounded-md border border-border px-3 py-2 text-left text-sm text-muted-foreground transition hover:border-blue-500/50 hover:text-foreground"
                    >
                        {suggestion}
                    </button>
                ))}
            </div>

            <div className="border-t border-border p-3">
                <div className="flex items-end gap-2">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Ask the assistant..."
                        rows={2}
                        className="flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <button
                        type="button"
                        disabled
                        title="Not available yet"
                        aria-label="Send"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-500/50 text-white opacity-60"
                    >
                        <Send className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
