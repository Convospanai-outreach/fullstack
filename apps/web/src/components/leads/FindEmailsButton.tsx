"use client";

import Link from "next/link";
import { useLiveFeatureKeys } from "@/components/dashboard/SectionTabs";
import { HIDDEN_FEATURES } from "@/lib/productFlags";

// The email finder used to be its own sidebar entry; it's now an action on Leads,
// shown once the feature is live for the workspace.
export function FindEmailsButton() {
    const liveKeys = useLiveFeatureKeys();
    if (!liveKeys.has("hunter-email-finder")) return null;

    return (
        <Link
            href={HIDDEN_FEATURES["hunter-email-finder"].openPath}
            className="h-9 border border-input rounded-md px-4 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2"
        >
            Find emails
        </Link>
    );
}
