
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { getBrowserApiBase } from "@/lib/api/browserBase";

interface BulkActionBarProps {
    type: "lead" | "campaign";
    selectedIds: string[];
    onClearSelection: () => void;
    onRefresh: () => void;
}

export default function BulkActionBar({ type, selectedIds, onClearSelection, onRefresh }: BulkActionBarProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const router = useRouter();

    if (selectedIds.length === 0) return null;

    const performAction = async (action: string, payload?: any) => {
        setIsProcessing(true);
        try {
            const res = await fetch(getBrowserApiBase() + "/bulk/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action,
                    type,
                    ids: selectedIds,
                    payload
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Action failed");

            toast.success(`${action} successful (${data.result.count} items)`);
            onClearSelection();
            onRefresh();
            router.refresh();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-background border border-border text-foreground px-6 py-3 rounded-full shadow-2xl flex items-center space-x-6 z-50 animate-in slide-in-from-bottom-4">
            <div className="font-medium text-sm">
                <span className="text-primary font-bold">{selectedIds.length}</span> items selected
            </div>

            <div className="h-4 w-px bg-secondary" />

            <div className="flex space-x-2">
                {type === "lead" && (
                    <button
                        onClick={() => {
                            const tag = prompt("Enter tag to add:");
                            if (tag) performAction("tag", { tags: [tag] });
                        }}
                        disabled={isProcessing}
                        className="px-3 py-1.5 text-xs font-medium bg-card hover:bg-secondary rounded-md transition-colors"
                    >
                        Tag
                    </button>
                )}

                <button
                    onClick={() => {
                        if (confirm("Are you sure you want to delete these items?")) {
                            performAction("delete");
                        }
                    }}
                    disabled={isProcessing}
                    className="px-3 py-1.5 text-xs font-medium bg-destructive/30 text-destructive hover:bg-destructive/50 rounded-md transition-colors"
                >
                    Delete
                </button>
            </div>

            <button onClick={onClearSelection} className="text-muted-foreground hover:text-foreground transition-colors">
                ✕
            </button>
        </div>
    );
}
