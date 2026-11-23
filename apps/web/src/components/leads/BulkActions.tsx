"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";

interface BulkActionsProps {
    selectedCount: number;
    onDelete: () => void;
    onExport: () => void;
    onClearSelection: () => void;
}

export default function BulkActions({ selectedCount, onDelete, onExport, onClearSelection }: BulkActionsProps) {
    if (selectedCount === 0) return null;

    return (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
            <GlassCard className="flex items-center gap-4 px-6 py-3 bg-background/90 border-primary/30 shadow-2xl backdrop-blur-xl">
                <span className="text-foreground font-medium">
                    {selectedCount} selected
                </span>

                <div className="h-6 w-px bg-foreground/20" />

                <div className="flex gap-2">
                    <Button onClick={onExport} variant="outline" className="px-3 py-1 text-sm">
                        Export
                    </Button>
                    <Button onClick={onDelete} variant="destructive" className="px-3 py-1 text-sm">
                        Delete
                    </Button>
                </div>

                <button
                    onClick={onClearSelection}
                    className="ml-2 text-muted-foreground hover:text-foreground text-sm"
                >
                    Cancel
                </button>
            </GlassCard>
        </div>
    );
}
