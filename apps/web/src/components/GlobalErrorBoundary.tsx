"use client";

import React from "react";
import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";
import type { FallbackProps } from "react-error-boundary";
import { Button } from "./ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";

    return (
        <div className="min-h-screen flex items-center justify-center bg-foreground/90 p-4">
            <div className="max-w-md w-full bg-foreground/5 border border-foreground/10 rounded-2xl p-8 text-center backdrop-blur-xl">
                <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="w-8 h-8 text-destructive" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Something went wrong</h2>
                <p className="text-muted-foreground mb-6 text-sm">{message}</p>
                <Button
                    variant="default"
                    className="w-full flex items-center justify-center gap-2"
                    onClick={resetErrorBoundary}
                >
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                </Button>
            </div>
        </div>
    );
}

export function GlobalErrorBoundary({ children }: { children: React.ReactNode }) {
    return (
        <ReactErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
            {children}
        </ReactErrorBoundary>
    );
}
