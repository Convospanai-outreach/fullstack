"use client";

import { useState, useEffect } from "react";
import { MobileMenu } from "./MobileMenu";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationBell } from "./ui/NotificationBell";
import { NavDropdown, NavItem } from "./NavDropdown";
import {
    LayoutDashboard,
    Megaphone,
    FileText,
    Workflow,
    MessageSquare,
    Database,
    Upload,
    Link2,
    UserCircle,
    Users,
    ShieldCheck,
    Activity,
    Gauge,
    Heart,
    BarChart3,
    Cpu,
} from "lucide-react";

export function NavBar() {
    const [open, setOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Flat links for mobile menu
    const navLinks = [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/campaigns", label: "Campaigns" },
        { href: "/templates", label: "Templates" },
        { href: "/workflows", label: "Workflows" },
        { href: "/inbox", label: "Inbox" },
        { href: "/csv-ingestion", label: "Import" },
        { href: "/integrations", label: "Integrations" },
        { href: "/profile", label: "Profile" },
        { href: "/team", label: "Team" },
        { href: "/admin/users", label: "Users" },
        { href: "/admin/usage", label: "Usage" },
        { href: "/admin/ai-config", label: "AI Config" },
        { href: "/admin/audit", label: "Audit" },
        { href: "/admin/rate-limits", label: "Rate Limits" },
        { href: "/admin/health", label: "Health" },
    ];

    // Dropdown groups
    const outreachItems: NavItem[] = [
        { href: "/campaigns", label: "Campaigns", icon: Megaphone },
        { href: "/templates", label: "Templates", icon: FileText },
        { href: "/workflows", label: "Workflows", icon: Workflow },
    ];

    const conversationsItems: NavItem[] = [
        { href: "/inbox", label: "Inbox", icon: MessageSquare },
    ];

    const dataItems: NavItem[] = [
        { href: "/csv-ingestion", label: "Import", icon: Upload },
        { href: "/integrations", label: "Integrations", icon: Link2 },
    ];

    const accountItems: NavItem[] = [
        { href: "/profile", label: "Profile", icon: UserCircle },
        { href: "/team", label: "Team", icon: Users },
    ];

    const adminItems: NavItem[] = [
        { href: "/admin/users", label: "Users", icon: Users },
        { href: "/admin/usage", label: "Usage", icon: BarChart3 },
        { href: "/admin/ai-config", label: "AI Config", icon: Cpu },
        { href: "/admin/audit", label: "Audit", icon: Activity },
        { href: "/admin/rate-limits", label: "Rate Limits", icon: Gauge },
        { href: "/admin/health", label: "Health", icon: Heart },
    ];

    const isDashboardActive = pathname === "/dashboard";

    return (
        <nav
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b border-white/0 ${scrolled ? "glass border-white/10 shadow-lg py-3" : "bg-transparent py-5 backdrop-blur-sm"
                }`}
        >
            <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:shadow-blue-500/25 transition-all">
                        C
                    </div>
                    <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        ConvoSpan
                    </span>
                </Link>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center space-x-1">
                    {/* Dashboard - Direct Link */}
                    <Link
                        href="/dashboard"
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${isDashboardActive
                            ? "bg-white/10 text-white shadow-inner"
                            : "text-gray-400 hover:text-white hover:bg-white/5"
                            }`}
                    >
                        <LayoutDashboard className="w-4 h-4" />
                        <span>Dashboard</span>
                    </Link>

                    {/* Dropdowns */}
                    <NavDropdown label="Outreach" icon={Megaphone} items={outreachItems} />
                    <NavDropdown label="Conversations" icon={MessageSquare} items={conversationsItems} />
                    <NavDropdown label="Data" icon={Database} items={dataItems} />
                    <NavDropdown label="Account" icon={UserCircle} items={accountItems} />
                    <NavDropdown label="Admin" icon={ShieldCheck} items={adminItems} />
                </div>


                {/* Right Side Actions */}
                <div className="hidden md:flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs font-medium text-gray-300">1,250 Credits</span>
                    </div>

                    <div className="h-6 w-px bg-white/10" />

                    <NotificationBell />

                    <button className="w-9 h-9 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 p-[2px] hover:scale-105 transition-transform">
                        <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center overflow-hidden">
                            <span className="text-sm font-bold text-white">JD</span>
                        </div>
                    </button>
                </div>

                {/* Mobile Toggle */}
                <button
                    className="md:hidden p-2 text-gray-300 hover:text-white transition-colors"
                    onClick={() => setOpen(true)}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-6 h-6"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                        />
                    </svg>
                </button>
            </div>

            <MobileMenu isOpen={open} onClose={() => setOpen(false)} links={navLinks} />
        </nav>
    );
}
