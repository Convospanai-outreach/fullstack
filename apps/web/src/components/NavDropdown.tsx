"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LucideIcon } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface NavItem {
    href: string;
    label: string;
    icon?: LucideIcon;
}

export interface NavDropdownProps {
    label: string;
    icon?: LucideIcon;
    items: NavItem[];
}

export function NavDropdown({ label, icon: Icon, items }: NavDropdownProps) {
    const pathname = usePathname();
    const isActive = items.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"));

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 outline-none ${isActive
                        ? "bg-foreground/10 text-foreground shadow-inner"
                        : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                        }`}
                >
                    {Icon && <Icon className="w-4 h-4" />}
                    <span>{label}</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="start"
                sideOffset={8}
                className="min-w-[180px] bg-background/95 backdrop-blur-xl border border-foreground/10 rounded-xl shadow-2xl p-1.5"
            >
                {items.map((item) => {
                    const ItemIcon = item.icon;
                    const isItemActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                        <DropdownMenuItem key={item.href} asChild>
                            <Link
                                href={item.href}
                                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${isItemActive
                                    ? "bg-primary/20 text-primary"
                                    : "text-foreground/80 hover:text-foreground hover:bg-foreground/5"
                                    }`}
                            >
                                {ItemIcon && <ItemIcon className="w-4 h-4" />}
                                {item.label}
                            </Link>
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
