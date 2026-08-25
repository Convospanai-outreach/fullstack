"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, ArrowRight, Info } from "lucide-react";
import { getFeatureHelpForPath } from "@/lib/featureHelp";

export function WorkspaceHelpPanel() {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();
    const containerRef = useRef<HTMLDivElement>(null);
    const help = pathname ? getFeatureHelpForPath(pathname) : null;

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

    // Close automatically on navigation so the panel doesn't show stale context.
    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setOpen((prev) => !prev)}
                data-tour="help-panel"
                className={`p-1.5 rounded-md transition-colors ${
                    open ? "bg-white/8 text-white/80" : "text-white/40 hover:text-white/70 hover:bg-white/5"
                }`}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label="What is this page?"
            >
                <Compass className="w-4 h-4" />
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label="Page guide"
                    className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-white/10 bg-surface-panel shadow-xl z-[60] p-4"
                >
                    {help ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                <span className="text-sm font-semibold text-white">{help.label}</span>
                            </div>
                            <p className="text-[12.5px] leading-relaxed text-white/70">{help.blurb}</p>
                            <div className="rounded-md bg-white/4 border border-white/6 p-2.5">
                                <span className="block text-[10px] uppercase tracking-wide font-medium text-white/30 mb-1">
                                    When to use it
                                </span>
                                <p className="text-[12px] text-white/60">{help.whenToUse}</p>
                            </div>
                            {help.overlapNote && (
                                <div className="rounded-md bg-amber-500/8 border border-amber-500/15 p-2.5">
                                    <span className="block text-[10px] uppercase tracking-wide font-medium text-amber-400/70 mb-1">
                                        Don't confuse this with…
                                    </span>
                                    <p className="text-[12px] text-amber-100/80">{help.overlapNote}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-[12.5px] text-white/50">
                            No guide written for this page yet.
                        </p>
                    )}

                    <Link
                        href="/tools"
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-white/6 text-[12px] font-medium text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        See everything the workspace can do
                        <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>
            )}
        </div>
    );
}
