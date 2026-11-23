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
    <div className="flex items-center gap-2 p-3 bg-primary/5 border border-dashed border-primary/18 rounded-lg text-xs text-muted-foreground">
      <Info className="w-3.5 h-3.5 text-primary flex-shrink-0" />
      <span>
        {message}{' '}
        {ctaLabel && ctaHref && (
          <Link href={ctaHref} className="text-primary underline underline-offset-2">
            {ctaLabel}
          </Link>
        )}
      </span>
    </div>
  );
}
