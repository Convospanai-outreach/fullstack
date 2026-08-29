"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Grid2x2, ExternalLink, EyeOff } from "lucide-react";
import {
    HIDDEN_FEATURE_CATEGORY_BY_KEY,
    HIDDEN_FEATURE_CATEGORY_ORDER,
    type HiddenFeatureCategory,
    type HiddenFeatureKey,
} from "@/lib/productFlags";

type ToolStatus = {
    key: HiddenFeatureKey;
    label: string;
    description: string;
    openPath: string;
    built: boolean;
    enabled: boolean;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function ToolsMenu() {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const { data } = useSWR<{ features: ToolStatus[] }>(
        open ? "/api/settings/hidden-features" : null,
        fetcher
    );
    const tools = data?.features ?? [];

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open]);

    const categories = HIDDEN_FEATURE_CATEGORY_ORDER
        .map((category: HiddenFeatureCategory) => ({
            category,
            items: tools.filter((f) => HIDDEN_FEATURE_CATEGORY_BY_KEY[f.key] === category),
        }))
        .filter((group) => group.items.length > 0);

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setOpen((prev) => !prev)}
                data-tour="tools-menu"
                className={`p-1.5 rounded-md transition-colors ${
                    open ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="Tools"
            >
                <Grid2x2 className="w-4 h-4" />
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-card shadow-xl z-[60] p-3"
                >
                    {!data ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">Loading tools…</div>
                    ) : (
                        categories.map(({ category, items }) => (
                            <div key={category} className="mb-3 last:mb-0">
                                <span className="block px-1 pb-1 text-[10px] uppercase tracking-wide font-medium text-muted-foreground">
                                    {category}
                                </span>
                                <div className="space-y-0.5">
                                    {items.map((feature) => {
                                        const isLive = feature.built && feature.enabled;
                                        const href = isLive
                                            ? feature.openPath
                                            : `/settings/features?feature=${feature.key}`;

                                        return (
                                            <Link
                                                key={feature.key}
                                                href={href}
                                                onClick={() => setOpen(false)}
                                                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[12.5px] text-foreground hover:bg-accent transition-colors"
                                            >
                                                {isLive ? (
                                                    <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                                                ) : (
                                                    <EyeOff className="w-3.5 h-3.5 flex-shrink-0 text-warning" />
                                                )}
                                                <span className="flex-1 truncate">{feature.label}</span>
                                                {!isLive && (
                                                    <span className="text-[9.5px] uppercase tracking-wide text-warning">
                                                        Off
                                                    </span>
                                                )}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}

                    <Link
                        href="/tools"
                        onClick={() => setOpen(false)}
                        className="block mt-2 pt-2 border-t border-border px-2 py-1.5 text-center text-[12px] font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                        View all tools →
                    </Link>
                </div>
            )}
        </div>
    );
}
