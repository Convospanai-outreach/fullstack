"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Dashboard Error:", error);
    }, [error]);

    return (
        <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-8 text-center bg-black/20 backdrop-blur-sm rounded-xl border border-white/5">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
                <AlertCircle className="w-8 h-8 text-red-500" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-gray-400 mb-8 max-w-md">
                An error occurred while loading this part of the dashboard. Your navigation is still active, and you can try refreshing just this section.
            </p>

            <div className="flex gap-4">
                <Button onClick={() => reset()} className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                </Button>
                <Button variant="outline" onClick={() => window.location.reload()}>
                    Full Refresh
                </Button>
            </div>

            {error.digest && (
                <p className="mt-8 text-xs text-gray-600 font-mono">Error ID: {error.digest}</p>
            )}
        </div>
    );
}
