"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getJobs } from "@/lib/api/jobs";

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
                return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-400 dark:border-emerald-700";
            case "running":
                return "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200 border-sky-400 dark:border-sky-700";
            case "failed":
                return "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200 border-red-400 dark:border-red-700";
            default:
                return "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-200 border-gray-400 dark:border-gray-600";
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Background Jobs</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Monitor background orchestration tasks and execution history.</p>
                </div>
                <button
                    onClick={loadJobs}
                    className="self-start sm:self-auto bg-blue-700 hover:bg-blue-800 text-white font-semibold px-4 py-2 rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-700"
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
                        className="px-3 py-2 text-sm bg-background text-foreground border border-gray-400 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
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
                        className="px-3 py-2 text-sm bg-background text-foreground border border-gray-400 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
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
                <div role="alert" className="bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}

            {loading ? (
                <div role="status" aria-live="polite" className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" aria-hidden="true"></div>
                    <p className="mt-2 text-sm font-medium text-foreground">Loading jobs...</p>
                </div>
            ) : jobs.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-lg border border-border">
                    <p className="text-muted-foreground font-medium">No jobs found matching the selected filters.</p>
                </div>
            ) : (
                <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
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
                                                className="text-sky-700 dark:text-sky-400 hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
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

