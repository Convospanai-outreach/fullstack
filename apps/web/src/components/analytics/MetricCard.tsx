import { GlassCard } from "@/components/ui/GlassCard"
import { LucideIcon } from "lucide-react"

interface MetricCardProps {
    label: string
    value: string | number
    trend?: number
    icon: LucideIcon
    color?: string
}

export default function MetricCard({ label, value, trend, icon: Icon, color = "text-accent-blue" }: MetricCardProps) {
    return (
        <GlassCard className="flex flex-col justify-between h-[120px]">
            <div className="flex justify-between items-start">
                <span className="text-text-secondary text-sm font-medium">{label}</span>
                <div className={`p-2 rounded-lg bg-white/5 ${color}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            <div>
                <div className="text-3xl font-bold text-text-primary">{value}</div>
                {trend !== undefined && (
                    <div className={`text-xs mt-1 font-medium ${trend >= 0 ? 'text-accent-mint' : 'text-red-400'}`}>
                        {trend > 0 ? '+' : ''}{trend}% from last week
                    </div>
                )}
            </div>
        </GlassCard>
    )
}
