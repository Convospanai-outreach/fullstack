import { HIDDEN_FEATURES, type HiddenFeatureKey } from "@/lib/productFlags";

export interface FeatureHelp {
    key: string;
    label: string;
    href: string;
    blurb: string;
    whenToUse: string;
    overlapNote?: string;
}

interface NavHelpEntry {
    label: string;
    href: string;
    pathPrefixes: string[];
    blurb: string;
    whenToUse: string;
    overlapNote?: string;
}

// The ~21 real, always-visible nav destinations (sidebar + approvals/inbox).
// Grounded in each page's actual subtitle/content, not guessed — see OPEN-83
// follow-up work. Hidden/gated features (Labs) are handled separately
// below via HIDDEN_FEATURES so their copy isn't duplicated in two places.
const NAV_FEATURE_HELP: Record<string, NavHelpEntry> = {
    "dashboard": {
        label: "Home",
        href: "/dashboard",
        pathPrefixes: ["/dashboard"],
        blurb: "Your home base: meetings booked, active leads, and drafts waiting on you, plus where you are in the outreach workflow.",
        whenToUse: "Start here every time you log in to see what needs your attention today.",
    },
    "leads": {
        label: "Leads",
        href: "/leads",
        pathPrefixes: ["/leads"],
        blurb: "The master list of every contact you're tracking, with enrichment status and outreach stage.",
        whenToUse: "Use this to add, search, or review any individual contact's record.",
    },
    "pipeline": {
        label: "Pipeline",
        href: "/pipeline",
        pathPrefixes: ["/pipeline"],
        blurb: "A kanban board of your leads sorted by deal stage (Cold to Meeting Booked), with AI-suggested next actions per lead.",
        whenToUse: "Use this for a visual, deal-stage view instead of a flat list — and to accept AI task suggestions for a specific lead.",
    },
    "campaigns": {
        label: "Campaigns",
        href: "/campaigns",
        pathPrefixes: ["/campaigns"],
        blurb: "Deploy and monitor your outreach sequences — who they're going to, what's been sent, and how they're performing.",
        whenToUse: "Use this to launch a new outreach sequence or check on one already running.",
    },
    "calendar": {
        label: "Calendar",
        href: "/calendar",
        pathPrefixes: ["/calendar"],
        blurb: "Your upcoming meetings and calls booked through outreach.",
        whenToUse: "Check here before your day starts, or to confirm a meeting actually landed.",
    },
    "intel": {
        label: "Buyer signals",
        href: "/intel",
        pathPrefixes: ["/intel"],
        blurb: "A live feed of buying-intent signals — which companies and industries are showing interest right now, and how strong that signal is.",
        whenToUse: "Use this to spot which accounts are heating up before they show up as hot leads.",
        overlapNote: "Not the same as the other Reports tabs — Buyer signals is a real-time feed about who's interested; ROI, Journey and AI are after-the-fact performance reporting.",
    },
    "analytics-roi": {
        label: "Reports",
        href: "/analytics/roi",
        pathPrefixes: ["/analytics"],
        blurb: "Revenue, funnel conversion, and campaign performance over a selected time window, with a CSV export.",
        whenToUse: "Use this to answer \"is this working\" and to report results.",
        overlapNote: "Different from Buyer signals (live signals) and the Trust overview's activity chart (security/compliance events, not revenue).",
    },
    "governance": {
        label: "Trust overview",
        href: "/governance",
        pathPrefixes: ["/governance"],
        blurb: "Your security and compliance posture — active guardrails, policy violations, and audit event volume.",
        whenToUse: "Use this to check your platform's safety controls, not your sales performance.",
    },
    "templates": {
        label: "Templates",
        href: "/templates",
        pathPrefixes: ["/templates"],
        blurb: "Reusable email/message templates you save and reuse across campaigns.",
        whenToUse: "Use this to store a message you'll send again, or edit one you've already saved.",
        overlapNote: "Templates store finished messages. Playbooks (Content) store a whole multi-step outreach strategy. Content studio (Labs) is for localizing a campaign's language for international markets, not everyday template editing.",
    },
    "icp-builder": {
        label: "Ideal customer",
        href: "/icp-builder",
        pathPrefixes: ["/icp-builder"],
        blurb: "Answer a few questions about your ideal customer and get an AI-generated targeting profile: keywords, a boolean search string, and a persona hook.",
        whenToUse: "Use this before a prospecting push, to define exactly who you're looking for.",
    },
    "landing-pages": {
        label: "Landing Pages",
        href: "/landing-agent/new",
        pathPrefixes: ["/landing-agent"],
        blurb: "Start a new campaign by filling out an intake form that generates a landing page for it.",
        whenToUse: "Use this when a campaign needs its own dedicated landing page.",
    },
    "automations": {
        label: "Automations",
        href: "/automations",
        pathPrefixes: ["/automations"],
        blurb: "Your event-based automation rules (\"when X happens, do Y\") — turn them on or off, and jump into the visual builder.",
        whenToUse: "Use this as your main list for reviewing and toggling automations on or off.",
        overlapNote: "Automations and \"Workflows\" (both under Campaigns) manage the same underlying records. Treat Workflows as redundant with Automations.",
    },
    "admin": {
        label: "Admin",
        href: "/admin",
        pathPrefixes: ["/admin"],
        blurb: "Super-admin/system-admin controls — restricted to those roles.",
        whenToUse: "Only relevant if you hold a Super Admin or System Admin role.",
    },
    "monitoring": {
        label: "Monitoring",
        href: "/monitoring",
        pathPrefixes: ["/monitoring"],
        blurb: "Real-time infrastructure health — is the system itself up and running correctly.",
        whenToUse: "Check here if something in the app seems broken or slow, to see if it's an infra issue.",
        overlapNote: "About server/infra health, not your background jobs (Background jobs, in Labs) or orchestrated agent runs (Agent runs, in Labs).",
    },
    "audit-logs": {
        label: "Audit Logs",
        href: "/settings/audit",
        pathPrefixes: ["/settings/audit"],
        blurb: "A chronological record of system activity and automation history.",
        whenToUse: "Use this to trace exactly what happened and when, e.g. after an unexpected result.",
    },
    "team": {
        label: "Team",
        href: "/settings/team",
        pathPrefixes: ["/settings/team"],
        blurb: "Invite teammates and assign roles.",
        whenToUse: "Use this to add a new teammate or change someone's permissions.",
    },
    "billing": {
        label: "Billing",
        href: "/billing",
        pathPrefixes: ["/billing"],
        blurb: "Your plan, usage limits, credit top-ups, and invoice history.",
        whenToUse: "Use this to upgrade your plan, buy credits, or download an invoice.",
    },
    "crm-bridge": {
        label: "CRM sync",
        href: "/settings/crm",
        pathPrefixes: ["/settings/crm"],
        blurb: "Save your HubSpot, Salesforce or Pipedrive access token and map lead fields to CRM fields.",
        whenToUse: "Use this to set up a CRM connection and its field mapping.",
        overlapNote: "Leads is your contact database; this page only configures the CRM connection.",
    },
    "settings": {
        label: "Settings",
        href: "/settings",
        pathPrefixes: ["/settings"],
        blurb: "The umbrella for API keys, branding, notifications, and other account-level configuration.",
        whenToUse: "Use this for anything account or workspace configuration related.",
    },
    "approvals-inbox": {
        label: "Approvals",
        href: "/inbox?tab=approvals",
        pathPrefixes: ["/approvals"],
        blurb: "Sensitive actions (like an AI-drafted email) that are waiting on your sign-off before they go out.",
        whenToUse: "Check here whenever something needs a human okay before it happens.",
        overlapNote: "This is the Approvals tab of the Inbox; lead replies are on the Replies tab.",
    },
    "action-inbox": {
        label: "Inbox",
        href: "/inbox",
        pathPrefixes: ["/inbox"],
        blurb: "Lead replies and actions waiting for your approval (with stalled-lead nudges) in one place.",
        whenToUse: "Answer replies, mark each one's outcome, and approve or reject what's waiting on you.",
    },
    "tools": {
        label: "Labs",
        href: "/tools",
        pathPrefixes: ["/tools"],
        blurb: "A searchable hub for beta and advanced tools, showing which ones are actually turned on for your workspace.",
        whenToUse: "Open it from the Help menu or ⌘K to discover a tool you haven't tried yet.",
    },
};

// Text-only content for the 17 gated features already defined in
// productFlags.ts's HIDDEN_FEATURES (label/href/pathPrefixes come from there,
// so they aren't duplicated here).
const HIDDEN_FEATURE_HELP_TEXT: Record<HiddenFeatureKey, { whenToUse: string; overlapNote?: string }> = {
    "agents": {
        whenToUse: "Use this once you're ready to delegate multi-step work to an AI agent, not just generate a draft.",
    },
    "caller": {
        whenToUse: "Only relevant if your outreach includes phone calls.",
    },
    "whatsapp": {
        whenToUse: "Use this if you're running outreach over WhatsApp.",
    },
    "command-center": {
        whenToUse: "Use this to supervise multiple automated runs at once, not to check server health.",
        overlapNote: "Distinct from Monitoring (infra health) and Jobs (individual background task status), though the three sound similar.",
    },
    "csv-ingestion": {
        whenToUse: "Use this when you have a list of contacts from elsewhere you want to bring in at once.",
    },
    "edge": {
        whenToUse: "Only relevant if you're running an edge node for local/on-device automation.",
    },
    "hunter-email-finder": {
        whenToUse: "Use this when you have a name/company but no verified email yet.",
    },
    "crystal-knows": {
        whenToUse: "Use this to look up a person's DISC personality type before drafting outreach, or to check whether enrichment already found one.",
    },
    "jobs": {
        whenToUse: "Check here if something you triggered seems stuck or failed silently.",
    },
    "knowledge": {
        whenToUse: "Use this to make the AI's replies and drafts more accurate to your actual product or docs.",
    },
    "linkedin-runner": {
        whenToUse: "Use this if your outreach includes LinkedIn.",
    },
    "marketplace": {
        whenToUse: "Use this to get a head start instead of building something from scratch.",
    },
    "playbooks": {
        whenToUse: "Use this to reuse an entire proven multi-step approach, not just one email.",
    },
    "runtime": {
        whenToUse: "Mostly for advanced/technical troubleshooting.",
    },
    "scraper-bridge": {
        whenToUse: "Only relevant if you're piping in external scraped data.",
    },
    "sovereign": {
        whenToUse: "Only relevant if you have specific data-residency or compliance requirements.",
    },
    "studio": {
        whenToUse: "Only for multi-language/international campaign prep — not general template editing.",
        overlapNote: "Self-labeled \"Experimental / Internal Preview\" in the product — specifically for localizing a campaign's language and narrative, not a general-purpose writing tool.",
    },
    "workflows": {
        whenToUse: "Prefer the main Automations page in your sidebar — this is a near-duplicate.",
        overlapNote: "Manages the identical data as Automations (same underlying records). Automations is the one in your primary nav.",
    },
};

function toFeatureHelp(key: string, entry: NavHelpEntry): FeatureHelp {
    return { key, ...entry };
}

function toHiddenFeatureHelp(feature: (typeof HIDDEN_FEATURES)[HiddenFeatureKey]): FeatureHelp {
    const text = HIDDEN_FEATURE_HELP_TEXT[feature.key];
    return {
        key: feature.key,
        label: feature.label,
        href: feature.openPath,
        blurb: feature.description,
        whenToUse: text.whenToUse,
        ...(text.overlapNote ? { overlapNote: text.overlapNote } : {}),
    };
}

export function getAllFeatureHelp(): FeatureHelp[] {
    const nav = Object.entries(NAV_FEATURE_HELP).map(([key, entry]) => toFeatureHelp(key, entry));
    const hidden = Object.values(HIDDEN_FEATURES).map(toHiddenFeatureHelp);
    return [...nav, ...hidden];
}

export function getFeatureHelpForPath(pathname: string): FeatureHelp | null {
    for (const [key, entry] of Object.entries(NAV_FEATURE_HELP)) {
        if (entry.pathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
            return toFeatureHelp(key, entry);
        }
    }

    for (const feature of Object.values(HIDDEN_FEATURES)) {
        if (feature.pathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
            return toHiddenFeatureHelp(feature);
        }
    }

    return null;
}
