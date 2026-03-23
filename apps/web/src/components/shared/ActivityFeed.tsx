
import { formatDistanceToNow } from "date-fns";

export interface ActivityItem {
    id: string;
    type?: string;
    action?: string; // Fallback for AuditLog
    message?: string; // For Activity
    meta?: any;
    createdAt: string | Date;
}

interface ActivityFeedProps {
    items: ActivityItem[];
    title?: string;
    emptyMessage?: string;
}

export default function ActivityFeed({ items, title = "Activity Feed", emptyMessage = "No activity recorded yet." }: ActivityFeedProps) {
    if (items.length === 0) {
        return (
            <div className="bg-gray-800/50 rounded-xl p-8 text-center border border-gray-700">
                <p className="text-gray-400">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {title && <div className="px-6 py-4 border-b border-gray-800 font-semibold text-gray-200">{title}</div>}
            <div className="divide-y divide-gray-800">
                {items.map((item) => {
                    const primaryText = item.message || item.action || "Unknown Action";
                    // Try to extract more details from meta if available
                    const metaPreview = item.meta ? JSON.stringify(item.meta).slice(0, 50) : "";

                    return (
                        <div key={item.id} className="p-4 hover:bg-gray-800/50 transition-colors flex gap-4">
                            <div className="flex-shrink-0 mt-1">
                                <div className="w-2 h-2 rounded-full bg-blue-500 ring-4 ring-blue-500/20" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-200">
                                    {primaryText}
                                </p>
                                {metaPreview && (
                                    <p className="text-xs text-gray-500 mt-0.5 truncate font-mono">
                                        {metaPreview}
                                    </p>
                                )}
                            </div>
                            <div className="text-xs text-gray-500 whitespace-nowrap">
                                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
