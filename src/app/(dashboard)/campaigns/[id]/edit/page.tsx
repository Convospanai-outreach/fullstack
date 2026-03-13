"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSWRConfig } from "swr";

export default function EditCampaignPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const { mutate } = useSWRConfig();
    const { id } = params;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState("");
    const [status, setStatus] = useState("draft");

    useEffect(() => {
        fetch(`${process.env['NEXT_PUBLIC_API_URL']}/dashboard/campaigns/${id}`)
            .then(res => {
                if (!res.ok) throw new Error("Failed to fetch");
                return res.json();
            })
            .then(data => {
                setName(data.name);
                setStatus(data.status);
                setLoading(false);
            })
            .catch(_err => {
                toast.error("Could not load campaign");
                router.push("/dashboard/campaigns");
            });
    }, [id, router]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/dashboard/campaigns/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, status }),
            });

            if (!res.ok) throw new Error("Failed to update");

            // Revalidate SWR cache
            mutate(process.env['NEXT_PUBLIC_API_URL'] + "/dashboard/campaigns");

            toast.success("Campaign updated");
            router.push("/dashboard/campaigns");
        } catch (e) {
            console.error(e);
            toast.error("Failed to update campaign");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this campaign?")) return;

        try {
            const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/dashboard/campaigns/${id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to delete");

            mutate(process.env['NEXT_PUBLIC_API_URL'] + "/dashboard/campaigns");
            toast.success("Campaign deleted");
            router.push("/dashboard/campaigns");
        } catch {
            toast.error("Failed to delete campaign");
        }
    };

    if (loading) return <div className="p-8 text-white">Loading...</div>;

    return (
        <div className="max-w-2xl mx-auto pt-10 px-6">
            <h1 className="text-3xl font-bold mb-8 text-white">Edit Campaign</h1>

            <div className="glass p-8 rounded-2xl space-y-6">
                <div>
                    <label className="block text-sm text-gray-400 mb-2">Campaign Name</label>
                    <input
                        type="text"
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>

                <div>
                    <label className="block text-sm text-gray-400 mb-2">Status</label>
                    <select
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>

                <div className="flex justify-between pt-6 border-t border-white/10">
                    <button
                        onClick={handleDelete}
                        className="px-4 py-2 text-red-400 hover:text-red-300 transition"
                    >
                        Delete Campaign
                    </button>
                    <div className="flex gap-4">
                        <button
                            onClick={() => router.back()}
                            className="px-6 py-2 text-gray-400 hover:text-white transition"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2 bg-white text-black font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50"
                        >
                            {saving ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
