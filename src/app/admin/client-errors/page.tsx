"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Download, AlertCircle } from "lucide-react";

interface ClientError {
    id: string;
    message: string;
    stack?: string;
    componentStack?: string;
    url: string;
    userAgent: string;
    userId?: string;
    ip: string;
    metadata?: Record<string, any>;
    createdAt: string;
}

export default function ClientErrorsPage() {
    const [errors, setErrors] = useState<ClientError[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedError, setSelectedError] = useState<ClientError | null>(null);
    const [filter] = useState({
        limit: 50,
        url: "",
        userId: ""
    });

    const loadErrors = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filter.limit) params.append("limit", filter.limit.toString());
            if (filter.url) params.append("url", filter.url);
            if (filter.userId) params.append("userId", filter.userId);

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/client-errors?${params}`);
            const data = await response.json();

            if (response.ok) {
                setErrors(data.errors || []);
            } else {
                console.error("Failed to load errors:", data.error);
            }
        } catch (error) {
            console.error("Error loading client errors:", error);
        } finally {
            setLoading(false);
        }
    };

    const exportErrors = async () => {
        try {
            const response = await fetch(process.env.NEXT_PUBLIC_API_URL + "/admin/client-errors/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ format: "csv" })
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `client-errors-${Date.now()}.csv`;
                a.click();
            }
        } catch (error) {
            console.error("Export failed:", error);
        }
    };

    useEffect(() => {
        loadErrors();
    }, []);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    const getErrorSeverity = (error: ClientError) => {
        const message = error.message.toLowerCase();
        if (message.includes("fatal") || message.includes("critical")) return "critical";
        if (message.includes("warn")) return "warning";
        return "error";
    };

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <AlertCircle className="h-8 w-8 text-red-500" />
                        Client Error Dashboard
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Monitor and debug client-side errors
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={loadErrors} variant="outline" disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button onClick={exportErrors} variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Total Errors</div>
                    <div className="text-2xl font-bold">{errors.length}</div>
                </Card>
                <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Last Hour</div>
                    <div className="text-2xl font-bold">
                        {errors.filter(e =>
                            new Date(e.createdAt) > new Date(Date.now() - 3600000)
                        ).length}
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Unique URLs</div>
                    <div className="text-2xl font-bold">
                        {new Set(errors.map(e => e.url)).size}
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Unique Users</div>
                    <div className="text-2xl font-bold">
                        {new Set(errors.map(e => e.userId || e.ip)).size}
                    </div>
                </Card>
            </div>

            {/* Error List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-4">
                    <h2 className="font-semibold mb-4">Recent Errors ({errors.length})</h2>
                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                        {loading ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Loading...
                            </div>
                        ) : errors.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                No errors found
                            </div>
                        ) : (
                            errors.map((error) => (
                                <div
                                    key={error.id}
                                    onClick={() => setSelectedError(error)}
                                    className="p-3 border rounded-lg cursor-pointer hover:bg-muted transition-colors"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="font-mono text-sm truncate flex-1">
                                            {error.message}
                                        </div>
                                        <Badge variant={getErrorSeverity(error) === "critical" ? "destructive" : "secondary"}>
                                            {getErrorSeverity(error)}
                                        </Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate">
                                        {error.url}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        {formatDate(error.createdAt)}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>

                {/* Error Details */}
                <Card className="p-4">
                    <h2 className="font-semibold mb-4">Error Details</h2>
                    {selectedError ? (
                        <div className="space-y-4">
                            <div>
                                <div className="text-sm font-medium mb-1">Message</div>
                                <div className="p-2 bg-muted rounded font-mono text-sm">
                                    {selectedError.message}
                                </div>
                            </div>

                            <div>
                                <div className="text-sm font-medium mb-1">URL</div>
                                <div className="p-2 bg-muted rounded text-sm truncate">
                                    {selectedError.url}
                                </div>
                            </div>

                            <div>
                                <div className="text-sm font-medium mb-1">Timestamp</div>
                                <div className="p-2 bg-muted rounded text-sm">
                                    {formatDate(selectedError.createdAt)}
                                </div>
                            </div>

                            <div>
                                <div className="text-sm font-medium mb-1">User</div>
                                <div className="p-2 bg-muted rounded text-sm">
                                    {selectedError.userId || "Anonymous"} ({selectedError.ip})
                                </div>
                            </div>

                            {selectedError.stack && (
                                <div>
                                    <div className="text-sm font-medium mb-1">Stack Trace</div>
                                    <div className="p-2 bg-muted rounded font-mono text-xs overflow-x-auto max-h-[200px] overflow-y-auto">
                                        <pre>{selectedError.stack}</pre>
                                    </div>
                                </div>
                            )}

                            {selectedError.componentStack && (
                                <div>
                                    <div className="text-sm font-medium mb-1">Component Stack</div>
                                    <div className="p-2 bg-muted rounded font-mono text-xs overflow-x-auto max-h-[150px] overflow-y-auto">
                                        <pre>{selectedError.componentStack}</pre>
                                    </div>
                                </div>
                            )}

                            {selectedError.metadata && (
                                <div>
                                    <div className="text-sm font-medium mb-1">Metadata</div>
                                    <div className="p-2 bg-muted rounded font-mono text-xs overflow-x-auto">
                                        <pre>{JSON.stringify(selectedError.metadata, null, 2)}</pre>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            Select an error to view details
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
