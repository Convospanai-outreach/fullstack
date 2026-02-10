"use client";

import { NotificationBell } from "@/components/ui/NotificationBell";

import Link from "next/link";
import OfflineIndicator from "@/components/layout/OfflineIndicator";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Search,
    Sparkles,
    ChevronDown,
    Megaphone,
    Inbox,
    Users,
    LayoutDashboard,
    Workflow,
    BookOpen,
    FileText,
    CheckSquare,
    Store,
    Database,
    CreditCard,
    Settings
} from "lucide-react";
import { QuickActions } from "./QuickActions";

export function DashboardHeader() {

    return (
        <header className="fixed top-0 left-0 right-0 h-16 glass-panel border-b border-border z-40 flex items-center justify-between px-8 bg-surface-app/70 backdrop-blur-md">
            {/* Left: Logo & Navigation */}
            <div className="flex items-center gap-8">
                <Link href="/dashboard" className="text-xl font-bold text-foreground">
                    ConvoSpan
                </Link>

                <nav className="flex items-center gap-4">
                    {/* Execute Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors outline-none">
                            <span>Execute</span>
                            <ChevronDown className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48 bg-surface-app border-border text-foreground">
                            <DropdownMenuLabel>Operations</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem asChild>
                                <Link href="/campaigns" className="cursor-pointer flex items-center gap-2">
                                    <Megaphone className="w-4 h-4" /> Campaigns
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/inbox" className="cursor-pointer flex items-center gap-2">
                                    <Inbox className="w-4 h-4" /> Inbox
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/leads" className="cursor-pointer flex items-center gap-2">
                                    <Users className="w-4 h-4" /> Leads
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/pipeline" className="cursor-pointer flex items-center gap-2">
                                    <LayoutDashboard className="w-4 h-4" /> Pipeline
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Automate Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors outline-none">
                            <span>Assist</span>
                            <ChevronDown className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48 bg-surface-app border-border text-foreground">
                            <DropdownMenuLabel>Workflows & AI</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem asChild>
                                <Link href="/workflows" className="cursor-pointer flex items-center gap-2">
                                    <Workflow className="w-4 h-4" /> Workflows
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/playbooks" className="cursor-pointer flex items-center gap-2">
                                    <BookOpen className="w-4 h-4" /> Playbooks
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/templates" className="cursor-pointer flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> Templates
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/reviews" className="cursor-pointer flex items-center gap-2">
                                    <CheckSquare className="w-4 h-4" /> Approvals
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Grow Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors outline-none">
                            <span>Grow</span>
                            <ChevronDown className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48 bg-surface-app border-border text-foreground">
                            <DropdownMenuLabel>Resources</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem asChild>
                                <Link href="/marketplace" className="cursor-pointer flex items-center gap-2">
                                    <Store className="w-4 h-4" /> Marketplace
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/knowledge" className="cursor-pointer flex items-center gap-2">
                                    <Database className="w-4 h-4" /> Knowledge Base
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* System Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors outline-none">
                            <span>System</span>
                            <ChevronDown className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48 bg-surface-app border-border text-foreground">
                            <DropdownMenuLabel>Admin</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem asChild>
                                <Link href="/billing" className="cursor-pointer flex items-center gap-2">
                                    <CreditCard className="w-4 h-4" /> Billing
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/settings" className="cursor-pointer flex items-center gap-2">
                                    <Settings className="w-4 h-4" /> Settings
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </nav>
            </div>


            {/* Right: Search, Actions & Profile */}
            <div className="flex items-center gap-4">
                <div className="relative max-w-sm w-64 hidden xl:block group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-brand-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search..."
                        className="w-full bg-surface-accent/50 border border-input rounded-lg pl-10 pr-4 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-surface-accent focus:border-brand-500/50 transition-all"
                    />
                </div>

                <div className="h-6 w-px bg-border hidden xl:block" />

                <button className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 transition-all text-sm font-medium group">
                    <Sparkles className="w-4 h-4 group-hover:text-brand-300 transition-colors" />
                    <span className="hidden lg:inline">Ask AI</span>
                </button>


                <OfflineIndicator />
                <QuickActions />

                <div className="h-6 w-px bg-border" />

                <NotificationBell />

                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-brand-500 to-indigo-500 p-[2px] cursor-pointer hover:scale-105 transition-transform">
                    <div className="w-full h-full rounded-full bg-surface-panel flex items-center justify-center overflow-hidden">
                        <span className="text-xs font-bold text-white">JD</span>
                    </div>
                </div>
            </div>
        </header>
    );
}
