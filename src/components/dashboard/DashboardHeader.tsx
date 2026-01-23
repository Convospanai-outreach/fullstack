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
        <header className="fixed top-0 left-0 right-0 h-16 glass-panel border-b border-white/10 z-40 flex items-center justify-between px-8">
            {/* Left: Logo & Navigation */}
            <div className="flex items-center gap-8">
                <Link href="/dashboard" className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    ConvoSpan
                </Link>

                <nav className="flex items-center gap-4">
                    {/* Execute Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-gray-300 hover:text-white transition-colors outline-none">
                            <span>Execute</span>
                            <ChevronDown className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48 bg-[#020617] border-white/10 text-gray-300">
                            <DropdownMenuLabel>Operations</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-white/10" />
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
                        <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-gray-300 hover:text-white transition-colors outline-none">
                            <span>Assist</span>
                            <ChevronDown className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48 bg-[#020617] border-white/10 text-gray-300">
                            <DropdownMenuLabel>Workflows & AI</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-white/10" />
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
                        <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-gray-300 hover:text-white transition-colors outline-none">
                            <span>Grow</span>
                            <ChevronDown className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48 bg-[#020617] border-white/10 text-gray-300">
                            <DropdownMenuLabel>Resources</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-white/10" />
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
                        <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-gray-300 hover:text-white transition-colors outline-none">
                            <span>System</span>
                            <ChevronDown className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48 bg-[#020617] border-white/10 text-gray-300">
                            <DropdownMenuLabel>Admin</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-white/10" />
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
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search..."
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:bg-white/10 focus:border-blue-500/50 transition-all"
                    />
                </div>

                <div className="h-6 w-px bg-white/10 hidden xl:block" />

                <button className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 transition-all text-sm font-medium group">
                    <Sparkles className="w-4 h-4 group-hover:text-purple-200 transition-colors" />
                    <span className="hidden lg:inline">Ask AI</span>
                </button>


                <OfflineIndicator />
                <QuickActions />

                <div className="h-6 w-px bg-white/10" />

                <NotificationBell />

                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 p-[2px] cursor-pointer hover:scale-105 transition-transform">
                    <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center overflow-hidden">
                        <span className="text-xs font-bold text-white">JD</span>
                    </div>
                </div>
            </div>
        </header>
    );
}
