"use client";

import { Mail, UserPlus, Search, MousePointer2, AlertCircle } from 'lucide-react';
import { Badge } from '../ui/badge';

interface ActivityItem {
    id: string;
    type: 'email' | 'connection' | 'enrichment' | 'click' | 'error';
    title: string;
    timestamp: string;
    details?: string;
}

const ICONS = {
    email: { icon: Mail, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    connection: { icon: UserPlus, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    enrichment: { icon: Search, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    click: { icon: MousePointer2, color: 'text-orange-400', bg: 'bg-orange-400/10' },
    error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-400/10' },
};

export function ActivityFeed({ activities = [] }: { activities?: ActivityItem[] }) {
    if (activities.length === 0) {
        return (
            <div className="flex items-center justify-center p-8 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                No activity yet.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {activities.map((item) => {
                const style = ICONS[item.type];
                const Icon = style.icon;

                return (
                    <div key={item.id} className="flex gap-4 group">
                        <div className={`p-2.5 rounded-xl ${style.bg} ${style.color} h-fit shrink-0 group-hover:scale-110 transition-transform`}>
                            <Icon className="w-5 h-5" />
                        </div>

                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{item.title}</p>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{item.timestamp}</span>
                            </div>
                            {item.details && <p className="text-xs text-muted-foreground">{item.details}</p>}
                            <div className="pt-1">
                                <Badge variant={item.type === 'error' ? 'danger' : 'default'} className="!text-[8px] opacity-70">
                                    {item.type}
                                </Badge>
                            </div>
                        </div>
                    </div>
                );
            })}

            <button className="w-full py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors border-t border-border pt-6">
                View Full System Logs
            </button>
        </div>
    );
}
