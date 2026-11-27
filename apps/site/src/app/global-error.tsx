"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => { Sentry.captureException(error); }, [error]);
    return (
        <html>
            <body className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
                <div className="text-center">
                    <h2 className="text-3xl font-semibold">Something went wrong</h2>
                    <button onClick={reset} className="mt-6 border px-5 py-2">Try again</button>
                </div>
            </body>
        </html>
    );
}
