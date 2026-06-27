"use client";

// EmptyState.tsx
// Reusable empty state component for panels with no data.

import Link from "next/link";
import { Info } from "lucide-react";

interface EmptyStateProps {
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export function EmptyState({ message, ctaLabel, ctaHref }: EmptyStateProps) {
  return (
    <div className="flex items-center gap-2 p-3 bg-blue-500/5 border border-dashed border-blue-500/18 rounded-lg text-xs text-white/35">
      <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
      <span>
        {message}{' '}
        {ctaLabel && ctaHref && (
          <Link href={ctaHref} className="text-blue-400 underline underline-offset-2">
            {ctaLabel}
          </Link>
        )}
      </span>
    </div>
  );
}
