"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getJobs } from "@/lib/api/jobs";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default function JobsPage() {
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    useEffect(() => {
        loadJobs();
    }, [typeFilter, statusFilter]);

    const loadJobs = async () => {
        setLoading(true);
        setError("");
        try {
            const data = await getJobs({
                type: (typeFilter || undefined) as any,
                status: (statusFilter || undefined) as any,
            });
            setJobs(data.jobs);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load jobs");
        } finally {
            setLoading(false);
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

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <SectionHeader title="Background Jobs" subtitle="Monitor background orchestration tasks and execution history." />
                <button
                    onClick={loadJobs}
                    className="self-start sm:self-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/40"
                >
                    Refresh
                </button>
            </div>

            <div className="flex flex-wrap gap-4" role="search" aria-label="Filter background jobs">
                <div>
                    <label htmlFor="type" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        Filter by type
                    </label>
                    <select
                        id="type"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="px-3 py-2 text-sm bg-background text-foreground border border-border dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                    >
                        <option value="">All Types</option>
                        <option value="campaign_execution">Campaign Execution</option>
                        <option value="lead_enrichment">Lead Enrichment</option>
                        <option value="email_send">Email Send</option>
                        <option value="linkedin_scrape">LinkedIn Scrape</option>
                    </select>
                </div>

                <div>
                    <label htmlFor="status" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        Filter by status
                    </label>
                    <select
                        id="status"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 text-sm bg-background text-foreground border border-border dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                    >
                        <option value="">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="running">Running</option>
                        <option value="completed">Completed</option>
                        <option value="failed">Failed</option>
                    </select>
                </div>
            </div>

            {error && (
                <div role="alert" className="bg-destructive/10 dark:bg-destructive/40 border border-destructive/30 dark:border-destructive/30 text-destructive dark:text-destructive px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}

            {loading ? (
                <div role="status" aria-live="polite" className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" aria-hidden="true"></div>
                    <p className="mt-2 text-sm font-medium text-foreground">Loading jobs...</p>
                </div>
            ) : jobs.length === 0 ? (
                <div className="glass text-center py-12">
                    <p className="text-muted-foreground font-medium">No jobs found matching the selected filters.</p>
                </div>
            ) : (
                <div className="glass overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-border">
                            <thead className="bg-muted/60">
                                <tr>
                                    <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                                        Type
                                    </th>
                                    <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                                        Attempts
                                    </th>
                                    <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                                        Created
                                    </th>
                                    <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-card divide-y divide-border">
                                {jobs.map((job) => (
                                    <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                                            {job.type.replace(/_/g, " ")}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(
                                                    job.status
                                                )}`}
                                            >
                                                {job.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground/80">
                                            {job.attempts} / {job.maxAttempts}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground/80">
                                            {new Date(job.createdAt).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                                            <Link
                                                href={`/jobs/${job.id}`}
                                                className="text-primary dark:text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
                                            >
                                                View Details <span className="sr-only">for job {job.id}</span>
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

