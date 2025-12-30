"use client";

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    hint?: string;
    error?: string;
}

export function Input({ label, hint, error, className = '', ...props }: InputProps) {
    return (
        <div className="space-y-1 block w-full">
            {label && <span className="text-sm text-text-secondary font-medium">{label}</span>}
            <input
                {...props}
                className={`w-full rounded-lg bg-bg-glass border border-border-subtle px-3 py-2 text-white placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-blue transition-all ${error ? 'border-red-500/50 ring-red-500/20' : ''} ${className}`}
            />
            {error && <p className="text-xs text-red-400 font-medium">{error}</p>}
            {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
        </div>
    );
}
