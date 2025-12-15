"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/campaigns/StatusBadge";
import ActivityFeed from "@/components/shared/ActivityFeed";
import {
    getCampaign,
    updateCampaign,
    deleteCampaign,
    getCampaignAnalytics,
} from "@/lib/api/campaigns";
import CampaignCharts from "@/components/campaigns/CampaignCharts";
import dynamic from "next/dynamic";
// Removed unused Switch import

const ThreeAnalytics = dynamic(() => import("@/components/campaigns/ThreeAnalytics"), {
    ssr: false,
    loading: () => <div className="h-[400px] w-full bg-gray-50 animate-pulse rounded-lg" />
});

export default function CampaignDetailPage({
    params,
}: {
    params: { id: string };
}) {
    const router = useRouter();
    const [campaign, setCampaign] = useState<any>(null);
    const [analytics, setAnalytics] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        name: "",
        description: "",
        targetCount: 0,
    });
    const [activities, setActivities] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState("overview");
    const [is3DMode, setIs3DMode] = useState(false);

    useEffect(() => {
        loadCampaign();
        loadAnalytics();
        loadActivities();
    }, [params.id]);

    const loadCampaign = async () => {
        try {
            const data = await getCampaign(params.id);
            setCampaign(data);
            setEditData({
                name: data.name,
                description: data.description || "",
                targetCount: data.targetCount,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load campaign");
        } finally {
            setLoading(false);
        }
    };

    const loadAnalytics = async () => {
        try {
            const data = await getCampaignAnalytics(params.id);
            setAnalytics(data);
        } catch (err) {
            console.error("Failed to load analytics:", err);
        }
    };

    const loadActivities = async () => {
        try {
            const res = await fetch(`/api/campaigns/${params.id}/activity`);
            const data = await res.json();
            if (data.success) {
                setActivities(data.activities);
            }
        } catch (err) {
            console.error("Failed to load activities:", err);
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        try {
            await updateCampaign(params.id, { status: newStatus });
            loadCampaign();
            loadAnalytics();
            loadActivities(); // Refresh activity log
        } catch (err) {
            alert("Failed to update status");
        }
    };

    const handleSaveEdit = async () => {
        try {
            await updateCampaign(params.id, editData);
            setIsEditing(false);
            loadCampaign();
            loadActivities();
        } catch (err) {
            alert("Failed to update campaign");
        }
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this campaign?")) return;

        try {
            await deleteCampaign(params.id);
            router.push("/campaigns");
        } catch (err) {
            alert("Failed to delete campaign");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-gray-600">Loading campaign...</p>
                </div>
            </div>
        );
    }

    if (error || !campaign) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600 mb-4">{error || "Campaign not found"}</p>
                    <button
                        onClick={() => router.push("/campaigns")}
                        className="text-blue-600 hover:text-blue-700"
                    >
                        Back to campaigns
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6">
                    <button
                        onClick={() => router.push("/campaigns")}
                        className="text-blue-600 hover:text-blue-700 mb-4"
                    >
                        ← Back to campaigns
                    </button>

                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                            {isEditing ? (
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={editData.name}
                                        onChange={(e) =>
                                            setEditData({ ...editData, name: e.target.value })
                                        }
                                        className="text-3xl font-bold w-full px-3 py-2 border border-gray-300 rounded"
                                    />
                                    <textarea
                                        value={editData.description}
                                        onChange={(e) =>
                                            setEditData({ ...editData, description: e.target.value })
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded"
                                        rows={2}
                                    />
                                    <input
                                        type="number"
                                        value={editData.targetCount}
                                        onChange={(e) =>
                                            setEditData({
                                                ...editData,
                                                targetCount: parseInt(e.target.value) || 0,
                                            })
                                        }
                                        className="w-32 px-3 py-2 border border-gray-300 rounded"
                                    />
                                    <div className="space-x-2">
                                        <button
                                            onClick={handleSaveEdit}
                                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <h1 className="text-3xl font-bold text-gray-900">
                                        {campaign.name}
                                    </h1>
                                    {campaign.description && (
                                        <p className="mt-2 text-gray-600">{campaign.description}</p>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="ml-4">
                            <StatusBadge status={campaign.status} />
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200 mb-6">
                    <nav className="-mb-px flex space-x-8">
                        {["overview", "leads", "activity", "analytics"].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`
                                    whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm capitalize
                                    ${activeTab === tab
                                        ? "border-blue-500 text-blue-600"
                                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                    }
                                `}
                            >
                                {tab}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* OVERVIEW TAB */}
                    {activeTab === "overview" && (
                        <>
                            <div className="lg:col-span-2 space-y-6">
                                <div className="bg-white rounded-lg shadow p-6">
                                    <h2 className="text-xl font-semibold mb-4">Campaign Actions</h2>
                                    <div className="flex flex-wrap gap-2">
                                        {!isEditing && (
                                            <button
                                                onClick={() => setIsEditing(true)}
                                                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                                            >
                                                Edit Campaign
                                            </button>
                                        )}
                                        {campaign.status === "draft" && (
                                            <button
                                                onClick={() => handleStatusChange("active")}
                                                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                                            >
                                                Activate
                                            </button>
                                        )}
                                        {campaign.status === "active" && (
                                            <button
                                                onClick={() => handleStatusChange("paused")}
                                                className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
                                            >
                                                Pause
                                            </button>
                                        )}
                                        {campaign.status === "paused" && (
                                            <button
                                                onClick={() => handleStatusChange("active")}
                                                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                                            >
                                                Resume
                                            </button>
                                        )}
                                        {campaign.status !== "completed" && (
                                            <button
                                                onClick={() => handleStatusChange("completed")}
                                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                                            >
                                                Mark Complete
                                            </button>
                                        )}
                                        <button
                                            onClick={handleDelete}
                                            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                                        >
                                            Delete Campaign
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="bg-white rounded-lg shadow p-6">
                                    <h2 className="text-xl font-semibold mb-4">Stats</h2>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-sm text-gray-600">Total Leads</p>
                                            <p className="text-2xl font-bold">
                                                {analytics?.totalLeads || 0}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600">Target</p>
                                            <p className="text-2xl font-bold">{campaign.targetCount}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600">Completed</p>
                                            <p className="text-2xl font-bold">
                                                {campaign.completedCount}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600">Completion Rate</p>
                                            <p className="text-2xl font-bold">
                                                {analytics?.completionRate || 0}%
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {analytics?.leadsByStatus && (
                                    <div className="bg-white rounded-lg shadow p-6">
                                        <h2 className="text-xl font-semibold mb-4">Leads by Status</h2>
                                        <div className="space-y-2">
                                            {Object.entries(analytics.leadsByStatus).map(
                                                ([status, count]: [string, any]) => (
                                                    <div key={status} className="flex justify-between">
                                                        <span className="text-sm capitalize">{status}</span>
                                                        <span className="text-sm font-semibold">{count}</span>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* LEADS TAB */}
                    {activeTab === "leads" && (
                        <div className="lg:col-span-3 bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-semibold mb-4">Leads</h2>
                            {campaign.leads && campaign.leads.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead>
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                    Name
                                                </th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                    Email
                                                </th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                    Status
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {campaign.leads.map((lead: any) => (
                                                <tr key={lead.id}>
                                                    <td className="px-4 py-2 text-sm">
                                                        {lead.fullName || "—"}
                                                    </td>
                                                    <td className="px-4 py-2 text-sm">
                                                        {lead.email || "—"}
                                                    </td>
                                                    <td className="px-4 py-2 text-sm">{lead.status}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-gray-600">No leads assigned yet</p>
                            )}
                        </div>
                    )}

                    {/* ACTIVITY TAB */}
                    {activeTab === "activity" && (
                        <div className="lg:col-span-3">
                            <ActivityFeed
                                items={activities}
                                title="Recent Campaign Activity"
                                emptyMessage="No activity logs for this campaign yet."
                            />
                        </div>
                    )}

                    {/* ANALYTICS TAB */}
                    {activeTab === "analytics" && (
                        <div className="lg:col-span-3">
                            <div className="flex items-center justify-end mb-4 gap-3 bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                                <span className={`text-sm font-medium ${!is3DMode ? "text-blue-600" : "text-gray-400"}`}>2D Charts</span>
                                <button
                                    onClick={() => setIs3DMode(!is3DMode)}
                                    className={`relative w-14 h-7 rounded-full p-1 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${is3DMode ? "bg-purple-600" : "bg-gray-200"}`}
                                >
                                    <span className={`block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${is3DMode ? "translate-x-7" : "translate-x-0"}`} />
                                </button>
                                <span className={`text-sm font-medium ${is3DMode ? "text-purple-600 shimmer-text" : "text-gray-400"}`}>3D Immersive</span>
                            </div>

                            {analytics ? (
                                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden min-h-[450px]">
                                    {is3DMode ? (
                                        <div className="h-[450px] w-full bg-gradient-to-br from-gray-900 to-black p-4">
                                            <ThreeAnalytics data={analytics.timeline || []} />
                                        </div>
                                    ) : (
                                        <div className="p-6">
                                            <CampaignCharts
                                                timeline={analytics.timeline || []}
                                                leadsByStatus={analytics.leadsByStatus || {}}
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex h-[400px] items-center justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
