"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/campaigns/StatusBadge";
import ActivityFeed from "@/components/shared/ActivityFeed";
import {
    getCampaign,
    updateCampaign,
    deleteCampaign,
    getCampaignAnalytics,
} from "@/lib/api/campaigns";
import { getBrowserApiUrl } from "@/lib/api/browserBase";
// import CampaignCharts from "@/components/campaigns/CampaignCharts"; // Replaced by AnalyticsTab
import AnalyticsTab from "@/components/campaigns/AnalyticsTab";
import ExecutionTimeline from "@/components/campaigns/ExecutionTimeline";
import { PolicyGuard } from "@/components/governance/PolicyGuard";
import { checkCampaignPolicy } from "@/lib/policyUtils";

// Removed unused Switch import

// const ThreeAnalytics = dynamic(() => import("@/components/campaigns/ThreeAnalytics"), {
//     ssr: false,
//     loading: () => <div className="h-[400px] w-full bg-gray-50 animate-pulse rounded-lg" />
// });

export default function CampaignDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: campaignId } = use(params);
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
    }, [campaignId]);

    const loadCampaign = async () => {
        if (!campaignId || campaignId === "undefined") {
            setError("Invalid campaign ID.");
            setLoading(false);
            return;
        }
        try {
            const data = await getCampaign(campaignId);
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
        if (!campaignId || campaignId === "undefined") return;
        try {
            const data = await getCampaignAnalytics(campaignId);
            setAnalytics(data);
        } catch (err) {
            console.error("Failed to load analytics:", err);
        }
    };

    const loadActivities = async () => {
        if (!campaignId || campaignId === "undefined") return;
        try {
            const res = await fetch(getBrowserApiUrl(`/campaigns/${campaignId}/activity`));
            if (!res.ok) return;
            const data = await res.json();
            if (data?.success) {
                setActivities(data.activities);
            }
        } catch (err) {
            console.error("Failed to load activities:", err);
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        try {
            await updateCampaign(campaignId, { status: newStatus });
            if (newStatus === "active") {
                await fetch(`/api/campaigns/${campaignId}/run`, { method: "POST" }).catch((e) => {
                    console.warn("Campaign run endpoint warning:", e);
                });
            }
            loadCampaign();
            loadAnalytics();
            loadActivities(); // Refresh activity log
        } catch (err) {
            alert("Failed to update status");
        }
    };

    const handleSaveEdit = async () => {
        try {
            await updateCampaign(campaignId, editData);
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
            await deleteCampaign(campaignId);
            router.push("/campaigns");
        } catch (err) {
            alert("Failed to delete campaign");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                    <p className="mt-2 text-zinc-400">Loading campaign...</p>
                </div>
            </div>
        );
    }

    if (error || !campaign) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-500 mb-4">{error || "Campaign not found"}</p>
                    <button
                        onClick={() => router.push("/campaigns")}
                        className="text-purple-400 hover:text-purple-300"
                    >
                        Back to campaigns
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen text-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6">
                    <button
                        onClick={() => router.push("/campaigns")}
                        className="text-purple-400 hover:text-purple-300 mb-4 flex items-center gap-1 text-sm font-semibold transition-colors"
                    >
                        ← Back to campaigns
                    </button>

                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                            {isEditing ? (
                                <div className="space-y-3 max-w-xl">
                                    <input
                                        type="text"
                                        title="Campaign name"
                                        placeholder="Campaign name"
                                        value={editData.name}
                                        onChange={(e) =>
                                            setEditData({ ...editData, name: e.target.value })
                                        }
                                        className="text-3xl font-bold w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                    <textarea
                                        title="Campaign description"
                                        placeholder="Campaign description"
                                        value={editData.description}
                                        onChange={(e) =>
                                            setEditData({ ...editData, description: e.target.value })
                                        }
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        rows={2}
                                    />
                                    <input
                                        type="number"
                                        title="Target lead count"
                                        placeholder="Target count"
                                        value={editData.targetCount}
                                        onChange={(e) =>
                                            setEditData({
                                                ...editData,
                                                targetCount: parseInt(e.target.value) || 0,
                                            })
                                        }
                                        className="w-32 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                    <div className="space-x-2">
                                        <button
                                            onClick={handleSaveEdit}
                                            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className="bg-white/10 text-white px-4 py-2 rounded-lg hover:bg-white/20 transition"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <h1 className="text-3xl font-bold text-white">
                                        {campaign.name}
                                    </h1>
                                    {campaign.description && (
                                        <p className="mt-2 text-zinc-400">{campaign.description}</p>
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
                <div className="border-b border-white/10 mb-6">
                    <nav className="-mb-px flex space-x-8">
                        {["overview", "leads", "activity", "timeline", "analytics"].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`
                                    whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors
                                    ${activeTab === tab
                                        ? "border-purple-500 text-purple-400"
                                        : "border-transparent text-zinc-500 hover:text-zinc-300 hover:border-white/10"
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
                                <div className="glass-card p-6">
                                    <h2 className="text-xl font-semibold mb-4 text-white">Campaign Actions</h2>
                                    <div className="flex flex-wrap gap-2">
                                        {!isEditing && (
                                            <button
                                                onClick={() => setIsEditing(true)}
                                                className="bg-white/10 text-white px-4 py-2 rounded-lg hover:bg-white/20 transition"
                                            >
                                                Edit Campaign
                                            </button>
                                        )}
                                        {campaign.status === "draft" && (
                                            <PolicyGuard
                                                restriction={checkCampaignPolicy(campaign) ? "blocked" : "none"}
                                                reason={checkCampaignPolicy(campaign)}
                                                enabled={true}
                                            >
                                                <button
                                                    onClick={() => handleStatusChange("active")}
                                                    className={`px-4 py-2 rounded-lg text-white transition ${checkCampaignPolicy(campaign)
                                                        ? "bg-zinc-600 cursor-not-allowed opacity-50"
                                                        : "bg-emerald-600 hover:bg-emerald-700"
                                                        }`}
                                                >
                                                    Activate
                                                </button>
                                            </PolicyGuard>
                                        )}
                                        {campaign.status === "active" && (
                                            <button
                                                onClick={() => handleStatusChange("paused")}
                                                className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition"
                                            >
                                                Pause
                                            </button>
                                        )}
                                        {campaign.status === "paused" && (
                                            <PolicyGuard restriction="none">
                                                <button
                                                    onClick={() => handleStatusChange("active")}
                                                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition"
                                                >
                                                    Resume
                                                </button>
                                            </PolicyGuard>
                                        )}
                                        {campaign.status !== "completed" && (
                                            <button
                                                onClick={() => handleStatusChange("completed")}
                                                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                                            >
                                                Mark Complete
                                            </button>
                                        )}
                                        <button
                                            onClick={handleDelete}
                                            className="bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-700 transition"
                                        >
                                            Delete Campaign
                                        </button>
                                        <button
                                            onClick={() => router.push(`/leads/import?campaignId=${campaignId}`)}
                                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
                                        >
                                            Import Leads
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="glass-card p-6">
                                    <h2 className="text-xl font-semibold mb-4 text-white">Stats</h2>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-sm text-zinc-400">Total Leads</p>
                                            <p className="text-2xl font-bold text-white">
                                                {analytics?.totalLeads || 0}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-zinc-400">Target</p>
                                            <p className="text-2xl font-bold text-white">{campaign.targetCount}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-zinc-400">Completed</p>
                                            <p className="text-2xl font-bold text-white">
                                                {Math.min(campaign.completedCount, analytics?.totalLeads || campaign.targetCount || campaign.completedCount)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-zinc-400">Completion Rate</p>
                                            <p className="text-2xl font-bold text-white">
                                                {analytics?.completionRate || 0}%
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {analytics?.leadsByStatus && (
                                    <div className="glass-card p-6">
                                        <h2 className="text-xl font-semibold mb-4 text-white">Leads by Status</h2>
                                        <div className="space-y-2">
                                            {Object.entries(analytics.leadsByStatus).map(
                                                ([status, count]: [string, any]) => (
                                                    <div key={status} className="flex justify-between border-b border-white/5 pb-1">
                                                        <span className="text-sm capitalize text-zinc-400">{status}</span>
                                                        <span className="text-sm font-semibold text-white">{count}</span>
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
                        <div className="lg:col-span-3 glass-card p-6">
                            <h2 className="text-xl font-semibold mb-4 text-white">Leads</h2>
                            {campaign.leads && campaign.leads.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-white/10">
                                        <thead>
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                                    Name
                                                </th>
                                                <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                                    Email
                                                </th>
                                                <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                                    Status
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {campaign.leads.map((lead: any) => (
                                                <tr key={lead.id} className="hover:bg-white/[0.02] transition-colors">
                                                    <td className="px-4 py-2.5 text-sm text-slate-200">
                                                        {lead.fullName || "—"}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-sm text-slate-300">
                                                        {lead.email || "—"}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-sm">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-purple-500/10 text-purple-400">
                                                            {lead.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-zinc-500 mb-4">No leads assigned yet.</p>
                                    <button
                                        onClick={() => router.push(`/leads/import?campaignId=${campaignId}`)}
                                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-semibold transition"
                                    >
                                        Import Leads via CSV
                                    </button>
                                </div>
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

                    {/* TIMELINE TAB */}
                    {activeTab === "timeline" && (
                        <div className="lg:col-span-3 glass-card p-6">
                            <h2 className="text-xl font-semibold mb-6 text-white">Execution Timeline</h2>
                            <ExecutionTimeline campaignId={campaignId} />
                        </div>
                    )}

                    {/* ANALYTICS TAB */}
                    {activeTab === "analytics" && (
                        <div className="lg:col-span-3">
                            <div className="flex items-center justify-end mb-4 gap-3 bg-white/5 p-3 rounded-lg border border-white/10">
                                <span className={`text-sm font-medium ${!is3DMode ? "text-purple-400" : "text-zinc-500"}`}>2D Charts</span>
                                <button
                                    onClick={() => setIs3DMode(!is3DMode)}
                                    aria-label={is3DMode ? "Switch to 2D charts" : "Switch to 3D immersive view"}
                                    className={`relative w-14 h-7 rounded-full p-1 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${is3DMode ? "bg-purple-600" : "bg-white/10"}`}
                                >
                                    <span className={`block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${is3DMode ? "translate-x-7" : "translate-x-0"}`} />
                                </button>
                                <span className={`text-sm font-medium ${is3DMode ? "text-purple-400 shimmer-text" : "text-zinc-500"}`}>3D Immersive</span>
                            </div>

                            {analytics ? (
                                <div>
                                    <AnalyticsTab data={analytics} />
                                </div>
                            ) : (
                                <div className="flex h-[400px] items-center justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}
