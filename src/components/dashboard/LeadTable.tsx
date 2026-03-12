"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import BulkActions from "@/components/leads/BulkActions";

interface Lead {
    id: string;
    name?: string;
    email?: string;
    company?: string;
    role?: string;
    status?: string;
    createdAt: string;
}

interface LeadTableProps {
    leads: Lead[];
}

export function LeadTable({ leads = [] }: LeadTableProps) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const toggleSelectAll = () => {
        if (selectedIds.length === leads.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(leads.map(l => l.id));
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Delete ${selectedIds.length} leads?`)) return;
        try {
            await fetch(process.env['NEXT_PUBLIC_API_URL'] + "/leads/bulk", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: selectedIds })
            });
            window.location.reload();
        } catch (error) {
            console.error("Failed to delete leads", error);
        }
    };

    const handleBulkExport = () => {
        // In a real app, we'd POST ids to export endpoint
        window.location.href = `${process.env['NEXT_PUBLIC_API_URL']}/leads/export?ids=${selectedIds.join(",")}`;
    };

    return (
        <>
            <GlassCard>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold gradient-text">Recent Leads</h3>
                    <div className="flex gap-2">
                        <Button variant="default">Add New Lead</Button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-300">
                        <thead className="text-xs uppercase bg-white/5 text-gray-400">
                            <tr>
                                <th className="px-4 py-3 w-10">
                                    <input
                                        type="checkbox"
                                        checked={leads.length > 0 && selectedIds.length === leads.length}
                                        onChange={toggleSelectAll}
                                        className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                                    />
                                </th>
                                <th className="px-4 py-3 rounded-tl-lg">Name</th>
                                <th className="px-4 py-3">Email</th>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3 rounded-tr-lg">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leads.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-3 text-center text-gray-500">No leads found</td>
                                </tr>
                            ) : (
                                leads.map((lead) => (
                                    <tr key={lead.id} className={`border-b border-white/5 transition ${selectedIds.includes(lead.id) ? 'bg-blue-500/10' : 'hover:bg-white/5'}`}>
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(lead.id)}
                                                onChange={() => toggleSelect(lead.id)}
                                                className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                                            />
                                        </td>
                                        <td className="px-4 py-3 font-medium text-white">{lead.name || "Unknown"}</td>
                                        <td className="px-4 py-3">{lead.email || "—"}</td>
                                        <td className="px-4 py-3">{new Date(lead.createdAt).toLocaleDateString()}</td>
                                        <td className="px-4 py-3">
                                            <Badge variant={lead.status === "CONNECTED" ? "success" : "default"}>
                                                {lead.status || "New"}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </GlassCard>

            <BulkActions
                selectedCount={selectedIds.length}
                onDelete={handleBulkDelete}
                onExport={handleBulkExport}
                onClearSelection={() => setSelectedIds([])}
            />
        </>
    );
}
