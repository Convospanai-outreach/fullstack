"use client";

import React from 'react';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
    className?: string;
}

export function Badge({
    children,
    variant = 'default',
    className = ''
}: BadgeProps) {
    const variants = {
        default: 'bg-white/10 text-text-secondary border-white/5',
        success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        warning: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        danger: 'bg-red-500/10 text-red-400 border-red-500/20',
        info: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20',
    };

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border ${variants[variant]} ${className}`}>
            {children}
        </span>
    );
}
