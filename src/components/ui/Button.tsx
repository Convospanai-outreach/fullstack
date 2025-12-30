"use client";

import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'ghost' | 'danger' | 'outline';
    loading?: boolean;
}

export function Button({
    children,
    variant = 'primary',
    loading = false,
    className = '',
    ...props
}: ButtonProps) {
    const baseStyles = 'px-4 py-2 rounded-xl transition-all duration-200 font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';

    const variantStyles = {
        primary: 'bg-accent-blue text-white shadow-glow hover:bg-accent-blue/90 hover:shadow-accent-blue/40',
        ghost: 'bg-white/5 hover:bg-white/10 text-white',
        danger: 'bg-red-500/80 hover:bg-red-500 text-white',
        outline: 'border border-border-subtle hover:bg-white/5 text-white hover:border-white/20',
    };

    return (
        <button
            {...props}
            disabled={loading || props.disabled}
            className={`${baseStyles} ${variantStyles[variant]} ${className}`}
        >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {children}
        </button>
    );
}
