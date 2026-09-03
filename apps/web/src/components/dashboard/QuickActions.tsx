"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus, Sparkles, Target, Upload, Zap } from "lucide-react";

export function QuickActions() {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (buttonRef.current) {
            buttonRef.current.setAttribute("aria-expanded", isOpen ? "true" : "false");
        }
    }, [isOpen]);

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            if (!dropdownRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleEscape);
        };
    }, []);

    const actions = [
        {
            label: "New Campaign",
            href: "/campaigns/new",
            icon: Zap,
            desc: "Create a new outreach campaign workflow.",
            color: "text-blue-400"
        },
        {
            label: "Import Leads",
            href: "/leads",
            icon: Upload,
            desc: "Upload a CSV or confirm audience data before launch.",
            color: "text-emerald-400"
        },
        {
            label: "Build ICP",
            href: "/icp-builder",
            icon: Target,
            desc: "Define the audience profile before you create outreach.",
            color: "text-fuchsia-400",
            ai: true
        }
    ];

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                aria-haspopup="true"
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500"
            >
                <Plus className="h-4 w-4" />
                <span>Create</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="border-b border-border px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Quick start</p>
                        <p className="mt-2 text-sm text-muted-foreground">Choose the next action that best matches where you are in outreach setup.</p>
                    </div>
                    <div className="p-2 space-y-1">
                        {actions.map((action) => {
                            const Icon = action.icon;

                            return (
                                <Link
                                    key={action.label}
                                    href={action.href}
                                    onClick={() => setIsOpen(false)}
                                    className="flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors hover:bg-accent"
                                >
                                    <div className={`rounded-xl bg-muted p-2 transition-colors ${action.color}`}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-foreground">{action.label}</span>
                                            {action.ai && (
                                                <span className="flex items-center gap-1 rounded border border-fuchsia-500/30 bg-fuchsia-500/20 px-1.5 py-0.5 text-[10px] text-fuchsia-300">
                                                    <Sparkles className="h-3 w-3" /> AI
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-0.5 text-xs text-muted-foreground">{action.desc}</p>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
