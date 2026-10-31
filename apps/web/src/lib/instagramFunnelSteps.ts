// Setup checklist for "Instagram -> landing page -> lead". Pure: the page feeds it what the app
// already knows (connected accounts, domains, pages, keyword triggers) and it says what is done
// and what to do next. Nothing here saves anything.

export type FunnelInput = {
    accounts: { platform: string; status: string }[];
    domains: { status: "pending" | "active" | "invalid"; homeSlug: string | null }[];
    pages: { status?: string }[];
    triggers: { active: boolean; landingPageId: string | null; sentLast7Days: number }[];
};

export type StepState = "done" | "todo" | "blocked" | "optional";

export type FunnelStep = {
    key: "instagram" | "domain" | "page" | "trigger" | "test";
    title: string;
    state: StepState;
    detail: string;
    href: string;
    action: string;
};

export function computeFunnelSteps(input: FunnelInput): FunnelStep[] {
    const instagram = input.accounts.filter((a) => a.platform === "INSTAGRAM");
    const connected = instagram.filter((a) => a.status === "CONNECTED");
    const needsReconnect = instagram.length > 0 && connected.length === 0;
    const activeDomain = input.domains.find((d) => d.status === "active");
    const pendingDomain = input.domains.some((d) => d.status === "pending");
    const published = input.pages.filter((p) => p.status === "published");
    const linked = input.triggers.filter((t) => t.landingPageId);
    const live = linked.filter((t) => t.active);
    const hasConnection = connected.length > 0;

    const steps: FunnelStep[] = [
        {
            key: "instagram",
            title: "Connect Instagram",
            state: hasConnection ? "done" : "todo",
            detail: hasConnection
                ? `${connected.length} account${connected.length === 1 ? "" : "s"} connected.`
                : needsReconnect
                  ? "Your Instagram connection expired. Reconnect it."
                  : "Sign in with Instagram so comments and messages can start your funnel.",
            href: "/settings/social",
            action: needsReconnect ? "Reconnect" : hasConnection ? "Manage" : "Connect Instagram",
        },
        {
            key: "domain",
            title: "Use your own web address (optional)",
            state: activeDomain ? "done" : "optional",
            detail: activeDomain
                ? "Your pages open on your own domain."
                : pendingDomain
                  ? "Waiting for your DNS record to verify."
                  : "Without one, pages open on craftmyfunnel.live. Add a subdomain such as offers.yourbrand.com when you want your own.",
            href: "/settings/branding",
            action: activeDomain || pendingDomain ? "Manage" : "Add a domain",
        },
        {
            key: "page",
            title: "Publish a landing page",
            state: published.length > 0 ? "done" : "todo",
            detail:
                published.length > 0
                    ? `${published.length} published page${published.length === 1 ? "" : "s"}.${
                          activeDomain && !activeDomain.homeSlug ? " Pick one to open at your domain's root in Settings, Branding." : ""
                      }`
                    : input.pages.length > 0
                      ? "You have a draft page. Publish it so your replies can link to it."
                      : "Create a page with a form. Leads from it land in CraftMyFunnel.",
            href: "/landing-agent",
            action: input.pages.length > 0 ? "Open pages" : "Create a page",
        },
        {
            key: "trigger",
            title: "Set the keyword and reply",
            state: !hasConnection || published.length === 0 ? "blocked" : live.length > 0 ? "done" : "todo",
            detail:
                !hasConnection || published.length === 0
                    ? "Needs a connected Instagram account and a published page first."
                    : live.length > 0
                      ? `${live.length} auto-repl${live.length === 1 ? "y is" : "ies are"} on and linking to a page.`
                      : linked.length > 0
                        ? "Your auto-reply is saved but switched off. Switch it on when you're ready."
                        : "Choose a keyword, write the reply, and pick the page it links to.",
            href: "/settings/social",
            action: linked.length > 0 ? "Manage" : "Set up the reply",
        },
        {
            key: "test",
            title: "Test it",
            state: live.some((t) => t.sentLast7Days > 0) ? "done" : "blocked",
            detail: live.some((t) => t.sentLast7Days > 0)
                ? "An auto-reply has gone out in the last 7 days."
                : live.length > 0
                  ? "Comment your keyword on one of your posts from another account. The reply should arrive within a minute."
                  : "Available once an auto-reply is switched on.",
            href: "/settings/social",
            action: "Open triggers",
        },
    ];
    return steps;
}
