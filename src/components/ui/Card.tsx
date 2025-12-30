"use client";

import React from 'react';

interface CardProps {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
    footer?: React.ReactNode;
    className?: string;
}

export function Card({ children, title, subtitle, footer, className = '' }: CardProps) {
    return (
        <div className={`glass rounded-2xl overflow-hidden flex flex-col ${className}`}>
            {(title || subtitle) && (
                <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                    {title && <h3 className="text-xl font-bold text-white">{title}</h3>}
                    {subtitle && <p className="text-sm text-text-secondary mt-1">{subtitle}</p>}
                </div>
            )}

            <div className="p-6 flex-1">
                {children}
            </div>

            {footer && (
                <div className="p-6 border-t border-white/5 bg-white/[0.02]">
                    {footer}
                </div>
            )}
        </div>
    );
}
