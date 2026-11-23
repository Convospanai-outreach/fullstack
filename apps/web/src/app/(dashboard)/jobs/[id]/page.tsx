"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getJob, retryJob } from "@/lib/api/jobs";

export default function JobDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const router = useRouter();
    const [job, setJob] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        loadJob();
        // Auto-refresh for running jobs
        const interval = setInterval(() => {
            if (job?.status === "running" || job?.status === "pending") {
                loadJob();
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [id, job?.status]);

    const loadJob = async () => {
        try {
            const data = await getJob(id);
            setJob(data);
            setLoading(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load job");
            setLoading(false);
        }
    };

    const handleRetry = async () => {
        try {
            await retryJob(id);
            loadJob();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to retry job");
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "completed":
                return "bg-success/10 text-success dark:bg-success/20 dark:text-success border-success/30 dark:border-success/30";
            case "running":
                return "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary border-primary/30 dark:border-primary/30";
            case "failed":
                return "bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive border-destructive/30 dark:border-destructive/30";
            default:
                return "bg-secondary text-foreground dark:bg-card dark:text-foreground border-border dark:border-border";
        }
    };

    if (loading) {
        return (
            <div role="status" aria-live="polite" className="min-h-[50vh] flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" aria-hidden="true"></div>
                    <p className="mt-2 text-sm font-medium text-foreground">Loading job details...</p>
                </div>
            </div>
        );
    }

    if (error || !job) {
        return (
            <div role="alert" className="min-h-[50vh] flex items-center justify-center">
                <div className="text-center bg-card p-6 rounded-lg border border-border shadow-sm max-w-md">
                    <p className="text-destructive font-semibold mb-4">{error || "Job not found"}</p>
                    <Link
                        href="/jobs"
                        className="inline-flex items-center text-sm font-semibold text-primary dark:text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
                    >
                        ← Back to jobs
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl space-y-6">
            <Link
                href="/jobs"
                className="inline-flex items-center text-sm font-semibold text-primary dark:text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded mb-2"
            >
                ← Back to jobs
            </Link>

            <div className="bg-card rounded-lg border border-border shadow-sm p-6 space-y-6">
                <div className="flex flex-wrap justify-between items-start gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Job Details</h1>
                        <p className="text-xs text-muted-foreground font-mono mt-1">ID: {job.id}</p>
                    </div>
                    <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                            job.status
                        )}`}
                    >
                        {job.status}
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/30 rounded-md border border-border/50">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</p>
                        <p className="font-semibold text-foreground mt-0.5">{job.type.replace(/_/g, " ")}</p>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-md border border-border/50">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Priority</p>
                        <p className="font-semibold text-foreground mt-0.5">{job.priority}</p>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-md border border-border/50">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Attempts</p>
                        <p className="font-semibold text-foreground mt-0.5">
                            {job.attempts} / {job.maxAttempts}
                        </p>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-md border border-border/50">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Created</p>
                        <p className="font-semibold text-foreground mt-0.5">
                            {new Date(job.createdAt).toLocaleString()}
                        </p>
                    </div>
                    {job.startedAt && (
                        <div className="p-3 bg-muted/30 rounded-md border border-border/50">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Started</p>
                            <p className="font-semibold text-foreground mt-0.5">
                                {new Date(job.startedAt).toLocaleString()}
                            </p>
                        </div>
                    )}
                    {job.completedAt && (
                        <div className="p-3 bg-muted/30 rounded-md border border-border/50">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Completed</p>
                            <p className="font-semibold text-foreground mt-0.5">
                                {new Date(job.completedAt).toLocaleString()}
                            </p>
                        </div>
                    )}
                </div>

                {job.status === "failed" && job.attempts < job.maxAttempts && (
                    <div>
                        <button
                            onClick={handleRetry}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/40"
                        >
                            Retry Job
                        </button>
                    </div>
                )}
            </div>

            <section aria-labelledby="job-payload-heading" className="bg-card rounded-lg border border-border shadow-sm p-6">
                <h2 id="job-payload-heading" className="text-lg font-bold text-foreground mb-3">Payload</h2>
                <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs text-foreground font-mono border border-border/50">
                    {JSON.stringify(job.payload, null, 2)}
                </pre>
            </section>

            {job.result && (
                <section aria-labelledby="job-result-heading" className="bg-card rounded-lg border border-border shadow-sm p-6">
                    <h2 id="job-result-heading" className="text-lg font-bold text-foreground mb-3">Result</h2>
                    <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs text-foreground font-mono border border-border/50">
                        {JSON.stringify(job.result, null, 2)}
                    </pre>
                </section>
            )}

            {job.error && (
                <section aria-labelledby="job-error-heading" className="bg-card rounded-lg border border-destructive/30 dark:border-destructive/30 shadow-sm p-6">
                    <h2 id="job-error-heading" className="text-lg font-bold text-destructive dark:text-destructive mb-3">Error</h2>
                    <pre className="bg-destructive/10 dark:bg-destructive/40 p-4 rounded-md overflow-x-auto text-xs text-destructive dark:text-destructive font-mono border border-destructive/30 dark:border-destructive/60">
                        {job.error}
                    </pre>
                </section>
            )}
        </div>
    );
}

