import { PRODUCT_FLAGS, type HiddenFeatureKey } from "@/lib/productFlags";

// One home per concept: each sidebar entry is a section, and its pages render as tabs
// (SectionTabs) instead of separate sidebar entries. Routes stay where they are.

export interface NavLink {
    label: string;
    href: string;
    /** Path prefix that marks this link active, when it differs from href. */
    match?: string;
    /** Only shown once this HIDDEN_FEATURES key is built and enabled for the workspace. */
    feature?: HiddenFeatureKey;
}

export interface NavSection {
    key: string;
    label: string;
    tabs: NavLink[];
}

export const NAV_SECTIONS: NavSection[] = [
    { key: "home", label: "Home", tabs: [{ label: "Home", href: "/dashboard" }] },
    { key: "inbox", label: "Inbox", tabs: [{ label: "Inbox", href: "/inbox" }] },
    {
        key: "leads",
        label: "Leads",
        tabs: [
            { label: "People", href: "/leads" },
            { label: "Accounts", href: "/accounts" },
            { label: "Ideal customer", href: "/icp-builder" },
        ],
    },
    {
        key: "campaigns",
        label: "Campaigns",
        tabs: [
            { label: "Sequences", href: "/campaigns" },
            { label: "Automations", href: "/automations" },
            { label: "Workflows", href: "/workflows", feature: "workflows" },
            { label: "LinkedIn outreach", href: "/linkedin-runner", feature: "linkedin-runner" },
            { label: "WhatsApp", href: "/whatsapp", feature: "whatsapp" },
            { label: "Calling", href: "/caller", feature: "caller" },
        ],
    },
    {
        key: "pipeline",
        label: "Pipeline",
        tabs: [
            { label: "Board", href: "/pipeline" },
            { label: "Calendar", href: "/calendar" },
        ],
    },
    {
        key: "content",
        label: "Content",
        tabs: [
            { label: "Templates", href: "/templates" },
            { label: "Landing pages", href: "/landing-agent/new", match: "/landing-agent" },
            { label: "Playbooks", href: "/playbooks", feature: "playbooks" },
            { label: "Knowledge", href: "/knowledge", feature: "knowledge" },
            { label: "Content calendar", href: "/content/calendar", feature: "creator-funnel" },
            { label: "Launch plans", href: "/content/plans", feature: "creator-funnel" },
        ],
    },
    {
        key: "reports",
        label: "Reports",
        tabs: [
            { label: "ROI", href: "/analytics/roi" },
            { label: "Content ROI", href: "/analytics/content", feature: "creator-funnel" },
            { label: "Journey", href: "/analytics/journey" },
            { label: "AI", href: "/analytics/ai" },
            { label: "Buyer signals", href: "/intel" },
        ],
    },
];

export interface SettingsGroup {
    label: string;
    links: NavLink[];
}

export const SETTINGS_GROUPS: SettingsGroup[] = [
    {
        label: "Workspace",
        links: [
            { label: "General", href: "/settings/general" },
            { label: "Branding", href: "/settings/branding" },
            { label: "AI agent", href: "/settings/agent" },
            { label: "Features", href: "/settings/features" },
            { label: "Domain health", href: "/settings/domain-health" },
        ],
    },
    {
        label: "Mailboxes & Integrations",
        links: [
            { label: "Mailboxes", href: "/settings/mailboxes" },
            { label: "Do-not-contact list", href: "/settings/suppressions" },
            { label: "Social accounts", href: "/settings/social", feature: "creator-funnel" },
            ...(PRODUCT_FLAGS.emailFirstBeta ? [] : [{ label: "CRM sync", href: "/settings/crm" }]),
            { label: "Webhooks", href: "/settings/webhooks" },
            { label: "Personality insights", href: "/settings/crystal-knows" },
            { label: "API docs", href: "/docs/api" },
        ],
    },
    {
        label: "Trust",
        links: [
            { label: "Trust overview", href: "/governance" },
            { label: "Workspace policies", href: "/settings/governance" },
            { label: "Guardrails", href: "/settings/guardrails" },
            { label: "API keys", href: "/settings/keys" },
            { label: "Audit log", href: "/settings/audit" },
            { label: "Firewall", href: "/governance/firewall" },
            { label: "Access control", href: "/governance/access" },
            { label: "Single sign-on", href: "/settings/sso" },
        ],
    },
    {
        label: "Team & Billing",
        links: [
            { label: "Team", href: "/settings/team" },
            { label: "Billing", href: "/billing" },
            { label: "Usage & budgets", href: "/settings/budgeting" },
            { label: "Payments", href: "/settings/payments" },
        ],
    },
    {
        label: "Personal",
        links: [
            { label: "Profile", href: "/profile" },
            { label: "Notifications", href: "/settings/notifications" },
        ],
    },
];

/** Paths that belong to the Settings entry at the bottom of the sidebar. */
export const SETTINGS_PREFIXES = ["/settings", "/governance", "/billing", "/profile"];

export function matchesPath(prefix: string, pathname: string): boolean {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isLinkActive(link: NavLink, pathname: string): boolean {
    return matchesPath(link.match ?? link.href, pathname);
}

export function visibleTabs(section: NavSection, liveKeys: ReadonlySet<HiddenFeatureKey>): NavLink[] {
    return section.tabs.filter((tab) => !tab.feature || liveKeys.has(tab.feature));
}

export function sectionForPath(pathname: string): NavSection | undefined {
    return NAV_SECTIONS.find((section) => section.tabs.some((tab) => isLinkActive(tab, pathname)));
}
