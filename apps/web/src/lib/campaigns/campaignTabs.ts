// The tabs of a campaign's detail page, in display order.
export const CAMPAIGN_TABS = ["overview", "sequence", "leads", "activity", "timeline", "analytics"] as const;

// The tab a campaign page opens on: the one named in `?tab=` when it exists, otherwise the overview.
export function tabFromQuery(value: string | null): (typeof CAMPAIGN_TABS)[number] {
    return (CAMPAIGN_TABS as readonly string[]).includes(value ?? "") ? (value as (typeof CAMPAIGN_TABS)[number]) : "overview";
}
