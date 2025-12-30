"use client";

import { LucideIcon, Plus } from 'lucide-react';
import { Button } from '../ui/Button';

interface EmptyStateProps {
    title: string;
    description: string;
    icon: LucideIcon;
    actionLabel?: string;
    onAction?: () => void;
}

export function EmptyState({ title, description, icon: Icon, actionLabel, onAction }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center glass rounded-3xl border-dashed border-2 border-white/5 bg-white/[0.02]">
            <div className="bg-white/5 p-6 rounded-full mb-6">
                <Icon className="w-12 h-12 text-text-muted" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
            <p className="text-text-secondary max-w-sm mx-auto mb-8 leading-relaxed">
                {description}
            </p>
            {actionLabel && onAction && (
                <Button onClick={onAction} className="gap-2">
                    <Plus className="w-4 h-4" />
                    {actionLabel}
                </Button>
            )}
        </div>
    );
}
