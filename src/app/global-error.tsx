
"use client";

import { useEffect } from "react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Global Error Boundary caught error:", error);
    }, [error]);

    return (
        <html>
            <body>
                <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white px-4">
                    <h2 className="text-4xl font-bold mb-4">Critical System Error</h2>
                    <p className="text-gray-400 mb-8 max-w-md text-center">
                        The application encountered a critical error and cannot continue.
                    </p>
                    <button
                        onClick={() => reset()}
                        className="bg-white text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                    >
                        Reload Application
                    </button>
                </div>
            </body>
        </html>
    );
}
