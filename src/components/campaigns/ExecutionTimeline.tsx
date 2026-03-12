"use client";

import { useEffect, useState } from "react";

interface TimelineEvent {
    id: string;
    type: string;
    status: string;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    error?: string;
    attempts: number;
    meta?: any;
}

export default function ExecutionTimeline({ campaignId }: { campaignId: string }) {
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTimeline();
        const interval = setInterval(fetchTimeline, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, [campaignId]);

    const fetchTimeline = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orchestrator/timeline?campaignId=${campaignId}`);
            const data = await res.json();
            if (data.timeline) {
                setEvents(data.timeline);
            }
        } catch (err) {
            console.error("Failed to fetch timeline", err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "completed": return "bg-green-500";
            case "failed":
            case "dead_letter": return "bg-red-500";
            case "processing": return "bg-blue-500 animate-pulse";
            default: return "bg-gray-300";
        }
    };

    const formatJobType = (type: string) => {
        return type.replace(/_/g, " ").toUpperCase();
    };

    if (loading && events.length === 0) {
        return <div className="p-8 text-center text-gray-500">Loading timeline...</div>;
    }

    if (events.length === 0) {
        return <div className="p-8 text-center text-gray-500">No execution events recorded yet.</div>;
    }

    return (
        <div className="flow-root">
            <ul role="list" className="-mb-8">
                {events.map((event, eventIdx) => (
                    <li key={event.id}>
                        <div className="relative pb-8">
                            {eventIdx !== events.length - 1 ? (
                                <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                            ) : null}
                            <div className="relative flex space-x-3">
                                <div>
                                    <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${getStatusColor(event.status)}`}>
                                        {/* Icon based on status */}
                                        {event.status === 'completed' && (
                                            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                        {(event.status === 'failed' || event.status === 'dead_letter') && (
                                            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        )}
                                        {event.status === 'pending' && (
                                            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        )}
                                        {event.status === 'processing' && (
                                            <svg className="h-5 w-5 text-white animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                        )}
                                    </span>
                                </div>
                                <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                                    <div>
                                        <p className="text-sm text-gray-500">
                                            <span className="font-medium text-gray-900">{formatJobType(event.type)}</span>
                                            {event.attempts > 1 && <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Retry #{event.attempts - 1}</span>}
                                        </p>
                                        {event.error && (
                                            <p className="mt-1 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-100">
                                                Error: {event.error}
                                            </p>
                                        )}
                                    </div>
                                    <div className="whitespace-nowrap text-right text-sm text-gray-500">
                                        <time dateTime={event.createdAt}>
                                            {new Date(event.createdAt).toLocaleTimeString()}
                                        </time>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
