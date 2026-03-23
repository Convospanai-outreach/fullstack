
"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Test Crash Error Boundary caught error:", error);
    }, [error]);

    return (
        <div className="p-10 flex flex-col items-center justify-center text-red-600">
            <AlertTriangle className="h-12 w-12 mb-4" />
            <h2 className="text-2xl font-bold">Something went wrong!</h2>
            <p className="mb-4">This is the local error boundary catching the crash.</p>
            <button
                onClick={() => reset()}
                className="bg-red-100 px-4 py-2 rounded hover:bg-red-200"
            >
                Try again
            </button>
        </div>
    );
}
