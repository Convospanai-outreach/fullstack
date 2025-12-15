"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLeads } from "@/lib/api/leads";
import FilterBar from "@/components/shared/FilterBar";

import { toast } from "sonner";

export default function LeadsPage() {
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [search, setSearch] = useState("");
    const [enriching, setEnriching] = useState<Record<string, boolean>>({});

    useEffect(() => {
        loadLeads();
    }, [statusFilter]);

    const loadLeads = async () => {
        setLoading(true);
        setError("");
        try {
            const data = await getLeads({
                status: statusFilter || undefined,
                search: search || undefined,
            });
            setLeads(data.leads);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load leads");
        } finally {
            setLoading(false);
        }
    };

    const handleEnrich = async (id: string) => {
        setEnriching((prev) => ({ ...prev, [id]: true }));
        try {
            const res = await fetch(`/api/leads/${id}/enrich`, { method: "POST" });
            if (!res.ok) throw new Error("Enrichment failed");
            toast.success("Lead enriched successfully");
            await loadLeads();
        } catch (error) {
            toast.error("Failed to enrich lead");
        } finally {
            setEnriching((prev) => ({ ...prev, [id]: false }));
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
                    <div className="flex gap-2">
                        <Link
                            href="/leads/import"
                            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                        >
                            Import CSV
                        </Link>
                    </div>
                </div>

                <div className="mb-6">
                    <FilterBar
                        onSearch={({ query, status }) => {
                            setSearch(query);
                            setStatusFilter(status || "");
                        }}
                        placeholder="Search leads by name or email..."
                    />
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-6">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="mt-2 text-gray-600">Loading leads...</p>
                    </div>
                ) : leads.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                        <p className="text-gray-600 mb-4">No leads found</p>
                        <Link
                            href="/leads/import"
                            className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                            Import your first leads from CSV
                        </Link>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Email
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Campaign
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Company
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {leads.map((lead) => (
                                    <tr key={lead.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {lead.fullName || "—"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {lead.email}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${lead.status === 'enriched' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                {lead.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {lead.campaign?.name || "—"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {lead.company || "—"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {!lead.isEnriched ? (
                                                <button
                                                    onClick={() => handleEnrich(lead.id)}
                                                    disabled={enriching[lead.id]}
                                                    className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                                                >
                                                    {enriching[lead.id] ? "Enriching..." : "Enrich"}
                                                </button>
                                            ) : (
                                                <span className="text-green-600 text-xs">✓ Enriched</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
