"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getBrowserApiBase } from "@/lib/api/browserBase";

export default function TestErrorLoggingPage() {
    const [result, setResult] = useState<string>("");
    const [loading, setLoading] = useState(false);

    const testErrorLogging = async () => {
        setLoading(true);
        setResult("");

        try {
            // Send a test error to the API
            const response = await fetch(getBrowserApiBase() + '/errors/client', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: "Test error from error logging page",
                    stack: "Error: Test\\n  at testErrorLogging (test.ts:10:5)",
                    componentStack: "in TestComponent\\n  in ErrorBoundary",
                    url: window.location.href,
                    userAgent: navigator.userAgent,
                    metadata: {
                        test: true,
                        timestamp: new Date().toISOString()
                    }
                })
            });

            const data = await response.json();

            if (response.ok) {
                setResult(`✅ Success! Error logged with ID: ${data.errorId}`);
            } else {
                setResult(`❌ Failed: ${data.error}`);
            }
        } catch (error: any) {
            setResult(`❌ Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const triggerRealError = () => {
        // This will be caught by ErrorBoundary and logged automatically
        throw new Error("Intentional error to test ErrorBoundary logging");
    };

    return (
        <div className="container mx-auto p-8 max-w-4xl">
            <h1 className="text-3xl font-bold mb-6">Client Error Logging Test</h1>

            <div className="space-y-6">
                <Card className="p-6">
                    <h2 className="text-xl font-semibold mb-4">Test 1: Direct API Call</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                        This sends a test error directly to the /api/errors/client endpoint.
                    </p>
                    <Button
                        onClick={testErrorLogging}
                        disabled={loading}
                    >
                        {loading ? "Sending..." : "Send Test Error"}
                    </Button>
                    {result && (
                        <div className="mt-4 p-4 bg-muted rounded-lg">
                            <p className="font-mono text-sm">{result}</p>
                        </div>
                    )}
                </Card>

                <Card className="p-6 border-red-500">
                    <h2 className="text-xl font-semibold mb-4 text-red-600">
                        Test 2: ErrorBoundary Test (Dangerous!)
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">
                        This will throw an error that should be caught by ErrorBoundary and logged automatically.
                        ⚠️ This will crash this component!
                    </p>
                    <Button
                        onClick={triggerRealError}
                        variant="destructive"
                    >
                        Trigger Real Error
                    </Button>
                </Card>

                <Card className="p-6 bg-muted">
                    <h3 className="font-semibold mb-2">Implementation Details:</h3>
                    <ul className="text-sm space-y-2 list-disc list-inside text-muted-foreground">
                        <li>API Endpoint: <code>/api/errors/client</code></li>
                        <li>Rate Limit: 10 errors per minute per IP</li>
                        <li>Database Table: <code>ClientError</code></li>
                        <li>ErrorBoundary automatically logs all uncaught errors</li>
                    </ul>
                </Card>
            </div>
        </div>
    );
}
