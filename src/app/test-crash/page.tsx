
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export default function TestCrashPage() {
    const [shouldCrash, setShouldCrash] = useState(false);

    if (shouldCrash) {
        throw new Error("This is a manually triggered crash for testing purposes.");
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
            <h1 className="text-2xl font-bold mb-6">Error Boundary Test</h1>
            <p className="mb-6 text-gray-600 max-w-md text-center">
                Clicking the button below will throw a JavaScript error during rendering,
                triggering the nearest Error Boundary (src/app/error.tsx).
            </p>
            <Button
                variant="danger"
                onClick={() => setShouldCrash(true)}
            >
                Trigger Crash
            </Button>
        </div>
    );
}
