"use client";

import { Mail, UserPlus, Search, MousePointer2, AlertCircle } from 'lucide-react';
import { Badge } from '../ui/Badge';

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
    // Mock data if none provided
    const items = activities.length > 0 ? activities : [
        { id: '1', type: 'email', title: 'Sent "Follow up #2" to Sarah Connor', timestamp: '2 mins ago', details: 'Delivered via Gmail' },
        { id: '2', type: 'enrichment', title: 'AI Enriched 42 leads from CSV Import', timestamp: '15 mins ago' },
        { id: '3', type: 'connection', title: 'LinkedIn Connect sent to Mark Zuckerberg', timestamp: '1 hour ago', details: 'Note: Interested in Meta partnership' },
        { id: '4', type: 'error', title: 'Auto-pilot paused: Insufficient credits', timestamp: '2 hours ago' },
    ] as ActivityItem[];

    return (
        <div className="space-y-6">
            {items.map((item) => {
                const style = ICONS[item.type];
                const Icon = style.icon;

                return (
                    <div key={item.id} className="flex gap-4 group">
                        <div className={`p-2.5 rounded-xl ${style.bg} ${style.color} h-fit shrink-0 group-hover:scale-110 transition-transform`}>
                            <Icon className="w-5 h-5" />
                        </div>

                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-white group-hover:text-accent-blue transition-colors">{item.title}</p>
                                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{item.timestamp}</span>
                            </div>
                            {item.details && <p className="text-xs text-text-secondary">{item.details}</p>}
                            <div className="pt-1">
                                <Badge variant={item.type === 'error' ? 'danger' : 'default'} className="!text-[8px] opacity-70">
                                    {item.type}
                                </Badge>
                            </div>
                        </div>
                    </div>
                );
            })}

            <button className="w-full py-3 text-xs font-bold uppercase tracking-widest text-text-muted hover:text-white transition-colors border-t border-white/5 pt-6">
                View Full System Logs
            </button>
        </div>
    );
}
