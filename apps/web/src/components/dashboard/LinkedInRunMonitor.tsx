import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/badge";

interface Job {
    id: string;
    type: string;
    status: string;
    progress?: number;
    result?: any;
}

interface LinkedInRunMonitorProps {
    job?: Job | null;
}

export function LinkedInRunMonitor({ job }: LinkedInRunMonitorProps) {
    if (!job) {
        return (
            <GlassCard>
                <h3 className="text-xl font-bold gradient-text mb-4">LinkedIn Run Monitor</h3>
                <p className="text-muted-foreground text-sm">No active jobs.</p>
            </GlassCard>
        );
    }

    const progress = job.progress || 0;
    const successCount = job.result?.successCount || 0;
    const failCount = job.result?.failCount || 0;

    return (
        <GlassCard>
            <h3 className="text-xl font-bold gradient-text mb-4">LinkedIn Run Monitor</h3>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <p className="text-sm text-muted-foreground">Current Job</p>
                    <p className="font-medium text-foreground truncate max-w-[150px]">{job.type}</p>
                </div>
                <Badge variant={job.status === "completed" ? "success" : job.status === "failed" ? "danger" : "default"}>
                    {job.status}
                </Badge>
            </div>
            <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{progress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${job.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'}`}
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                <div className="bg-muted p-2 rounded-lg">
                    <p className="text-xs text-muted-foreground">Success</p>
                    <p className="text-lg font-bold text-green-400">{successCount}</p>
                </div>
                <div className="bg-muted p-2 rounded-lg">
                    <p className="text-xs text-muted-foreground">Failed</p>
                    <p className="text-lg font-bold text-red-400">{failCount}</p>
                </div>
            </div>
        </GlassCard>
    );
}
