"use client";

// SetupBanner.tsx
// Inline (not fixed) setup progress card.
// Renders only when setup is incomplete. Sits at the TOP of the dashboard page
// content, above the KPI row.

import Link from "next/link";
import { X } from "lucide-react";

interface SetupBannerProps {
  percent: number;
  onDismiss?: () => void;
}

export function SetupBanner({ percent, onDismiss }: SetupBannerProps) {
  return (
    <div className="bg-primary/6 border border-primary/18 rounded-lg p-3 mb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-primary text-xs font-medium">
            Launch readiness · {percent}% complete
          </p>
          {/* Progress bar */}
          <div className="h-0.5 bg-muted rounded-full mt-2">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-muted-foreground text-[11px] mt-1.5">
            Complete your setup to unlock the full workflow.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/setup"
            className="text-[11px] font-medium text-primary border border-primary/25 rounded-md px-2.5 py-1 hover:bg-primary/10 transition-colors"
          >
            Open setup →
          </Link>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
