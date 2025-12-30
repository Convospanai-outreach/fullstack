import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";

interface Activity {
    id: string;
    title: string;
    time: string;
    status: string;
}

interface ActivityTimelineProps {
    activities?: Activity[];
}

export function ActivityTimeline({ activities = [] }: ActivityTimelineProps) {
    return (
        <GlassCard className="h-full">
            <h3 className="text-xl font-bold gradient-text mb-4">Recent Campaigns</h3>
            <div className="space-y-4">
                {activities.length === 0 ? (
                    <p className="text-gray-500 text-center">No recent activity</p>
                ) : (
                    activities.map((activity) => (
                        <div key={activity.id} className="flex items-center justify-between border-b border-white/10 pb-2 last:border-0">
                            <div>
                                <p className="font-medium text-gray-200">{activity.title}</p>
                                <p className="text-xs text-gray-400">{activity.time}</p>
                            </div>
                            <Badge variant={activity.status === "completed" ? "success" : "default"}>
                                {activity.status}
                            </Badge>
                        </div>
                    ))
                )}
            </div>
        </GlassCard>
    );
}
