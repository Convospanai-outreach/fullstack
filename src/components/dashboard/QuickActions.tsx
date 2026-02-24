"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Plus, Upload, Target, Zap, ChevronDown, Sparkles } from "lucide-react";
import StrategyWizard from "@/components/campaigns/StrategyWizard";

export function QuickActions() {
    const [isOpen, setIsOpen] = useState(false);
    const [showWizard, setShowWizard] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const actions = [
        {
            label: "New Campaign",
            href: "#",
            onClick: () => setShowWizard(true),
            icon: Zap,
            desc: "Draft a SafeRun™ sequence",
            color: "text-blue-400"
        },
        {
            label: "Import Leads",
            href: "/leads",
            icon: Upload,
            desc: "Upload CSV or connect LinkedIn",
            color: "text-green-400"
        },
        {
            label: "Build ICP",
            href: "/icp-builder",
            icon: Target,
            desc: "Define your perfect customer",
            color: "text-purple-400",
            ai: true
        }
    ];

    return (
        <>
            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    aria-expanded={isOpen ? "true" : "false"}
                    aria-haspopup="true"
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-500/20"
                >
                    <Plus className="w-4 h-4" />
                    <span>Quick Action</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen && (
                    <div className="absolute right-0 mt-2 w-72 glass-card border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-2 space-y-1">
                            {actions.map((action) => {
                                const Icon = action.icon;
                                const Wrapper = action.onClick ? 'button' : Link;
                                const props = action.onClick
                                    ? { onClick: () => { action.onClick?.(); setIsOpen(false); }, className: "w-full text-left" }
                                    : { href: action.href, onClick: () => setIsOpen(false) };

                                return (
                                    <Wrapper
                                        key={action.label}
                                        {...props as any}
                                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors group w-full text-left"
                                    >
                                        <div className={`p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors ${action.color}`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-white">{action.label}</span>
                                                {action.ai && (
                                                    <span className="flex items-center gap-1 text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30">
                                                        <Sparkles className="w-3 h-3" /> AI
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-400 mt-0.5">{action.desc}</p>
                                        </div>
                                    </Wrapper>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Strategy Wizard Modal */}
            {showWizard && (
                <StrategyWizard onClose={() => setShowWizard(false)} />
            )}
        </>
    );
}
