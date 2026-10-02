"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle, ArrowRight, Info, BookOpen, FlaskConical } from "lucide-react";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
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
                    open ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label="Help"
            >
                <HelpCircle className="w-4 h-4" />
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label="Help"
                    className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-border bg-card shadow-xl z-[60] p-4"
                >
                    {help ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Info className="w-4 h-4 text-primary flex-shrink-0" />
                                <span className="text-sm font-semibold text-foreground">{help.label}</span>
                            </div>
                            <p className="text-[12.5px] leading-relaxed text-foreground/80">{help.blurb}</p>
                            <div className="rounded-md bg-muted border border-border p-2.5">
                                <span className="block text-[10px] uppercase tracking-wide font-medium text-muted-foreground mb-1">
                                    When to use it
                                </span>
                                <p className="text-[12px] text-muted-foreground">{help.whenToUse}</p>
                            </div>
                            {help.overlapNote && (
                                <div className="rounded-md bg-warning/8 border border-warning/15 p-2.5">
                                    <span className="block text-[10px] uppercase tracking-wide font-medium text-warning mb-1">
                                        Don't confuse this with…
                                    </span>
                                    <p className="text-[12px] text-warning/80">{help.overlapNote}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-[12.5px] text-muted-foreground">
                            No guide written for this page yet.
                        </p>
                    )}

                    <div className="mt-3 pt-3 border-t border-border space-y-1">
                        <Link
                            href="/help"
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-foreground hover:bg-accent transition-colors"
                        >
                            <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                            Help center
                            <ArrowRight className="w-3 h-3 ml-auto text-muted-foreground" />
                        </Link>
                        <Link
                            href="/tools"
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-foreground hover:bg-accent transition-colors"
                        >
                            <FlaskConical className="w-3.5 h-3.5 text-muted-foreground" />
                            Labs: beta and advanced tools
                            <ArrowRight className="w-3 h-3 ml-auto text-muted-foreground" />
                        </Link>
                        <div className="flex items-center justify-between rounded-md px-2 py-1 text-[12.5px] text-foreground">
                            Theme
                            <ThemeToggle />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
