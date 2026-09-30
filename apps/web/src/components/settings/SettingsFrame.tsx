"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SETTINGS_GROUPS, matchesPath } from "@/lib/navSections";

// The one Settings layout: a left sub-nav with five sections. Used by settings/layout.tsx
// and by the pages that belong to Settings but live outside /settings (governance, billing,
// profile), so every settings page renders under the same nav.
export function SettingsFrame({ children }: { children: React.ReactNode }) {
    const pathname = usePathname() ?? "";
    // The most specific link wins, so /governance/firewall highlights Firewall, not Trust overview.
    const activeHref = SETTINGS_GROUPS.flatMap((group) => group.links)
        .filter((link) => matchesPath(link.href, pathname))
        .sort((a, b) => b.href.length - a.href.length)[0]?.href;

    return (
        <div className="flex flex-col gap-6 md:flex-row">
            <nav aria-label="Settings" className="md:w-52 md:shrink-0 space-y-5">
                {SETTINGS_GROUPS.map((group) => (
                    <div key={group.label}>
                        <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{group.label}</p>
                        <div className="space-y-0.5">
                            {group.links.map((link) => {
                                const active = link.href === activeHref;
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        aria-current={active ? "page" : undefined}
                                        className={`block rounded-md px-2 py-1.5 text-[13px] transition-colors ${
                                            active
                                                ? "bg-primary/10 text-primary"
                                                : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                        }`}
                                    >
                                        {link.label}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    );
}
