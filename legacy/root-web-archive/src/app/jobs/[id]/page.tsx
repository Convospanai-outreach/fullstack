"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getJob, retryJob } from "@/lib/api/jobs";

export default function JobDetailPage({
    params,
}: {
    params: { id: string };
}) {
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
    }, [params.id, job?.status]);

    const loadJob = async () => {
        try {
            const data = await getJob(params.id);
            setJob(data);
            setLoading(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load job");
            setLoading(false);
        }
    };

    const handleRetry = async () => {
        try {
            await retryJob(params.id);
            loadJob();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to retry job");
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "completed":
                return "bg-green-100 text-green-800 border-green-300";
            case "running":
                return "bg-blue-100 text-blue-800 border-blue-300";
            case "failed":
                return "bg-red-100 text-red-800 border-red-300";
            default:
                return "bg-gray-100 text-gray-800 border-gray-300";
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-gray-600">Loading job...</p>
                </div>
            </div>
        );
    }

    if (error || !job) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600 mb-4">{error || "Job not found"}</p>
                    <button
                        onClick={() => router.push("/jobs")}
                        className="text-blue-600 hover:text-blue-700"
                    >
                        Back to jobs
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <button
                    onClick={() => router.push("/jobs")}
                    className="text-blue-600 hover:text-blue-700 mb-4"
                >
                    ← Back to jobs
                </button>

                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <div className="flex justify-between items-start mb-4">
                        <h1 className="text-2xl font-bold text-gray-900">Job Details</h1>
                        <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(
                                job.status
                            )}`}
                        >
                            {job.status}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <p className="text-sm text-gray-600">Job ID</p>
                            <p className="font-mono text-sm">{job.id}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Type</p>
                            <p className="font-medium">{job.type.replace(/_/g, " ")}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Priority</p>
                            <p className="font-medium">{job.priority}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Attempts</p>
                            <p className="font-medium">
                                {job.attempts} / {job.maxAttempts}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Created</p>
                            <p className="font-medium">
                                {new Date(job.createdAt).toLocaleString()}
                            </p>
                        </div>
                        {job.startedAt && (
                            <div>
                                <p className="text-sm text-gray-600">Started</p>
                                <p className="font-medium">
                                    {new Date(job.startedAt).toLocaleString()}
                                </p>
                            </div>
                        )}
                        {job.completedAt && (
                            <div>
                                <p className="text-sm text-gray-600">Completed</p>
                                <p className="font-medium">
                                    {new Date(job.completedAt).toLocaleString()}
                                </p>
                            </div>
                        )}
                    </div>

                    {job.status === "failed" && job.attempts < job.maxAttempts && (
                        <button
                            onClick={handleRetry}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                        >
                            Retry Job
                        </button>
                    )}
                </div>

                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <h2 className="text-lg font-semibold mb-3">Payload</h2>
                    <pre className="bg-gray-50 p-4 rounded overflow-x-auto text-sm">
                        {JSON.stringify(job.payload, null, 2)}
                    </pre>
                </div>

                {job.result && (
                    <div className="bg-white rounded-lg shadow p-6 mb-6">
                        <h2 className="text-lg font-semibold mb-3">Result</h2>
                        <pre className="bg-gray-50 p-4 rounded overflow-x-auto text-sm">
                            {JSON.stringify(job.result, null, 2)}
                        </pre>
                    </div>
                )}

                {job.error && (
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-lg font-semibold mb-3 text-red-600">Error</h2>
                        <pre className="bg-red-50 p-4 rounded overflow-x-auto text-sm text-red-800">
                            {job.error}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}
