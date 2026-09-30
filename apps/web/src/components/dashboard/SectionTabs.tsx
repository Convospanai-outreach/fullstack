"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import type { HiddenFeatureKey } from "@/lib/productFlags";
import { isLinkActive, sectionForPath, visibleTabs } from "@/lib/navSections";

type ToolStatus = { key: HiddenFeatureKey; built: boolean; enabled: boolean };

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/** HIDDEN_FEATURES keys that are both built and enabled for this workspace. */
export function useLiveFeatureKeys(): Set<HiddenFeatureKey> {
    const { data } = useSWR<{ features: ToolStatus[] }>("/api/settings/hidden-features", fetcher);
    return new Set((data?.features ?? []).filter((f) => f.built && f.enabled).map((f) => f.key));
}

// Rendered once by the dashboard shell above every page: the pages of the current
// sidebar section, as tabs. Sections with a single page show nothing.
export function SectionTabs() {
    const pathname = usePathname() ?? "";
    const liveKeys = useLiveFeatureKeys();
    const section = sectionForPath(pathname);
    if (!section) return null;

    const tabs = visibleTabs(section, liveKeys);
    if (tabs.length < 2) return null;

    return (
        <nav aria-label={`${section.label} pages`} className="mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border">
            {tabs.map((tab) => {
                const active = isLinkActive(tab, pathname);
                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        aria-current={active ? "page" : undefined}
                        className={`whitespace-nowrap border-b-2 px-3 py-2 text-[13px] transition-colors ${
                            active
                                ? "border-primary text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </nav>
    );
}
