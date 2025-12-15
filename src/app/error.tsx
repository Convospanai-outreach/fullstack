
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button"; // Assuming we have a Button ui component, otherwise standard button
import { AlertTriangle } from "lucide-react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error("Segment Error Boundary caught error:", error);
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 text-center">
                <div className="flex justify-center">
                    <div className="h-24 w-24 bg-red-100 rounded-full flex items-center justify-center">
                        <AlertTriangle className="h-12 w-12 text-red-600" />
                    </div>
                </div>
                <div>
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                        Something went wrong!
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        {error.message || "An unexpected error occurred."}
                    </p>
                    {error.digest && (
                        <p className="mt-1 text-xs text-gray-400">
                            Error ID: {error.digest}
                        </p>
                    )}
                </div>
                <div className="mt-8">
                    <button
                        onClick={
                            // Attempt to recover by trying to re-render the segment
                            () => reset()
                        }
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        Try again
                    </button>
                    <p className="mt-4 text-xs text-gray-500">
                        If the problem persists, please contact support.
                    </p>
                </div>
            </div>
        </div>
    );
}
