import { useState } from "react";

interface CampaignFormProps {
    initialData?: {
        name: string;
        description?: string;
        targetCount?: number;
    };
    onSubmit: (data: {
        name: string;
        description: string | undefined;
        targetCount: number | undefined;
    }) => Promise<void>;
    submitLabel?: string;
}

export default function CampaignForm({
    initialData,
    onSubmit,
    submitLabel = "Create Campaign",
}: CampaignFormProps) {
    const [name, setName] = useState(initialData?.name || "");
    const [description, setDescription] = useState(
        initialData?.description || ""
    );
    const [targetCount, setTargetCount] = useState(
        initialData?.targetCount || 0
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!name.trim()) {
            setError("Campaign name is required");
            return;
        }

        setLoading(true);
        try {
            await onSubmit({
                name: name.trim(),
                description: description.trim() || undefined,
                targetCount: targetCount || 0,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save campaign");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                    {error}
                </div>
            )}

            <div>
                <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                >
                    Campaign Name *
                </label>
                <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Q1 2025 Enterprise Outreach"
                    required
                />
            </div>

            <div>
                <label
                    htmlFor="description"
                    className="block text-sm font-medium text-gray-700 mb-1"
                >
                    Description
                </label>
                <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Target enterprise companies in tech sector..."
                />
            </div>

            <div>
                <label
                    htmlFor="targetCount"
                    className="block text-sm font-medium text-gray-700 mb-1"
                >
                    Target Lead Count
                </label>
                <input
                    type="number"
                    id="targetCount"
                    value={targetCount}
                    onChange={(e) => setTargetCount(parseInt(e.target.value) || 0)}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="100"
                />
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
                {loading ? "Saving..." : submitLabel}
            </button>
        </form>
    );
}
