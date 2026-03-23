"use client";

// React import removed

interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
    return (
        <div className={`relative overflow-hidden bg-white/5 rounded-lg ${className}`}>
            <div className="absolute inset-0 shimmer" />
        </div>
    );
}
