export interface HelpAction {
    label: string;
    href: string;
    kind: "page" | "mailto";
}

export interface HelpArticle {
    slug: string;
    title: string;
    category: string;
    summary: string;
    content: string;
    actions?: HelpAction[];
}

export const HELP_ARTICLES: HelpArticle[] = [
    {
        slug: "getting-started",
        title: "Getting Started with CraftMyFunnel AI",
        category: "General",
        summary: "Launch your workspace in four steps, from setup through first campaign.",
        content: `
# Welcome to CraftMyFunnel AI

CraftMyFunnel AI turns prospect data, messaging, and workflow automation into one operating surface for growth teams.

## First 30 minutes
1. Complete the workspace setup flow.
2. Connect at least one sending or outreach channel.
3. Import a lead list or sync your CRM.
4. Create a campaign and review the first AI draft before launch.

## What to do next
- Visit **Setup** to finish workspace checks.
- Open **Dashboard** to review progress and recommended actions.
- Use the in-app help assistant any time you get stuck.
        `.trim(),
        actions: [
            { label: "Open setup", href: "/setup", kind: "page" },
            { label: "Go to dashboard", href: "/dashboard", kind: "page" },
        ],
    },
    {
        slug: "workspace-setup",
        title: "Completing Workspace Setup",
        category: "Onboarding",
        summary: "Track the 11 launch steps and resolve blockers before campaigns go live.",
        content: `
# Completing Workspace Setup

The setup flow shows the exact prerequisites CraftMyFunnel AI needs before you can safely launch outreach.

## Required checks
- Account and team role verified
- Branding completed
- At least one sending path connected
- AI key configured
- Leads imported
- Billing and credits confirmed

## Recommended next steps
- Review missing prerequisites on the setup page
- Test your provider credentials before scheduling sends
- Keep one operator assigned to verify DNS and mailbox health
        `.trim(),
        actions: [
            { label: "Review setup checklist", href: "/setup", kind: "page" },
            { label: "Check mailbox status", href: "/settings/mailboxes", kind: "page" },
        ],
    },
    {
        slug: "managing-keys",
        title: "Managing AI and API Keys",
        category: "Settings",
        summary: "Add provider keys, keep them scoped, and validate them before launch.",
        content: `
# Managing AI and API Keys

CraftMyFunnel AI supports bring-your-own-provider keys for generation, analysis, and enrichment workflows.

## Best practice
1. Add only the keys required for your current workflow.
2. Prefer dedicated workspace-level credentials over personal keys.
3. Rotate keys if they were pasted into the wrong environment.
4. Validate the connection before starting a live campaign.

## Common issues
- Invalid key format
- Missing environment variable in the current workspace
- A provider key saved, but not enabled for the right feature
        `.trim(),
        actions: [
            { label: "Open settings", href: "/settings", kind: "page" },
            { label: "Contact support", href: "/contact", kind: "page" },
        ],
    },
    {
        slug: "lead-import",
        title: "Importing Leads Cleanly",
        category: "Data",
        summary: "Use CSV import, map fields carefully, and check email or LinkedIn coverage.",
        content: `
# Importing Leads Cleanly

Good campaign performance starts with clean source data.

## Before you import
- Remove obvious duplicates
- Keep company and contact names in separate columns
- Confirm email or LinkedIn profile coverage
- Include ownership or segment fields if your team uses routing

## Recommended flow
1. Upload a CSV.
2. Review the suggested field mapping.
3. Fix any ambiguous column matches.
4. Run the import and spot-check a few records.
        `.trim(),
        actions: [
            { label: "Import leads", href: "/leads/import", kind: "page" },
            { label: "Open dashboard", href: "/dashboard", kind: "page" },
        ],
    },
    {
        slug: "billing-and-plans",
        title: "Billing, Credits, and Plans",
        category: "Billing",
        summary: "Choose a plan, top up credits, and know when to contact sales.",
        content: `
# Billing, Credits, and Plans

Starter and growth plans are self-serve. Enterprise plans route through the contact team.

## Common billing tasks
- Compare plans on the pricing page
- Start checkout from billing settings
- Top up credits when usage spikes
- Contact the team for SSO, procurement, or custom limits

## If checkout fails
1. Confirm you are signed in.
2. Retry from the pricing or billing page.
3. If the payment sheet does not open, use the support assistant and include the plan you selected.
        `.trim(),
        actions: [
            { label: "Compare plans", href: "/pricing", kind: "page" },
            { label: "Talk to sales", href: "/contact", kind: "page" },
        ],
    },
];

export const HELP_PROMPTS = [
    "How do I finish workspace setup?",
    "Where do I add API keys?",
    "Why is checkout not working?",
    "How do I import leads?",
];

export const HELP_QUICK_ACTIONS: HelpAction[] = [
    { label: "Open help center", href: "/help", kind: "page" },
    { label: "Contact support", href: "/contact", kind: "page" },
    { label: "Email support", href: "mailto:contact.us@craftmyfunnel.live", kind: "mailto" },
];

function tokenize(input: string): string[] {
    return input
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((part) => part.length > 1);
}

export function searchHelpArticles(query: string): HelpArticle[] {
    const trimmed = query.trim();
    if (!trimmed) {
        return HELP_ARTICLES;
    }

    const tokens = tokenize(trimmed);

    return [...HELP_ARTICLES]
        .map((article) => {
            const haystack = `${article.title} ${article.category} ${article.summary} ${article.content}`.toLowerCase();
            const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
            return { article, score };
        })
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score || left.article.title.localeCompare(right.article.title))
        .map((entry) => entry.article);
}
