import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Info, AlertTriangle, CheckCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ROICardProps {
    title: string;
    value: string | number;
    trend: { value: number; isUp: boolean };
    status?: 'success' | 'warning' | 'danger';
    description?: string;
    prefix?: string;
    suffix?: string;
}

export function ROICard({ title, value, trend, status = 'success', description, prefix = '', suffix = '' }: ROICardProps) {
    const statusColor = {
        success: "text-emerald-500",
        warning: "text-amber-500",
        danger: "text-red-500",
    }[status];

    const StatusIcon = {
        success: CheckCircle,
        warning: Info,
        danger: AlertTriangle,
    }[status];

    return (
        <Card className="border-l-4" style={{
            borderLeftColor: status === 'success' ? '#10b981' : status === 'warning' ? '#f59e0b' : '#ef4444'
        }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                    {title}
                </CardTitle>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger>
                            <StatusIcon className={cn("h-4 w-4", statusColor)} />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Health Status: {status.toUpperCase()}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">
                    {prefix}{value}{suffix}
                </div>
                <div className="text-xs flex items-center mt-1">
                    <span className={cn(
                        "flex items-center font-medium",
                        trend.isUp ? "text-emerald-500" : "text-red-500"
                    )}>
                        {trend.isUp ? <ArrowUpRight className="h-4 w-4 mr-1" /> : <ArrowDownRight className="h-4 w-4 mr-1" />}
                        {Math.abs(trend.value)}%
                    </span>
                    <span className="text-muted-foreground ml-2">vs last month</span>
                </div>
                {description && (
                    <p className="text-[10px] text-muted-foreground mt-2 border-t pt-2 border-border/50">
                        {description}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
