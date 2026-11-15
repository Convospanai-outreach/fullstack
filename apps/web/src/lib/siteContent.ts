// Menu and hero text that editors change in the CMS (content/settings/*.json). A bad entry is dropped or
// replaced by the built-in text, so a slip in the editor can never blank the menu or the home page.

export type NavItem = { label: string; href: string; badge?: string };
export type NavGroup = { label: string; items: NavItem[] };

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
// A path on this site, or an https address. Anything else (javascript:, //host, http:) is refused.
const safeHref = (value: unknown): string => {
    const href = text(value);
    return /^\/(?!\/)/.test(href) || /^https:\/\/[^\s]+$/.test(href) ? href : "";
};

export function cleanNavGroups(raw: unknown): NavGroup[] {
    const groups = Array.isArray((raw as { groups?: unknown } | null)?.groups) ? (raw as { groups: unknown[] }).groups : [];
    return groups.flatMap((group): NavGroup[] => {
        const label = text((group as { label?: unknown } | null)?.label);
        const rawItems = (group as { items?: unknown } | null)?.items;
        const items = (Array.isArray(rawItems) ? rawItems : []).flatMap((item): NavItem[] => {
            const itemLabel = text((item as { label?: unknown } | null)?.label);
            const href = safeHref((item as { href?: unknown } | null)?.href);
            if (!itemLabel || !href) return [];
            const badge = text((item as { badge?: unknown } | null)?.badge);
            return [badge ? { label: itemLabel, href, badge } : { label: itemLabel, href }];
        });
        return label && items.length ? [{ label, items }] : [];
    });
}

export type HeroStage = { label: string; title: string; accent: string; detail: string };
export type HeroText = { topLine: string; startButton: string; finalButton: string; stages: HeroStage[] };

// The stages keep their order and count (the scroll animation depends on them); only their words change.
export function mergeHeroText(raw: unknown, defaults: HeroText): HeroText {
    const edited = (raw ?? {}) as Partial<Record<keyof HeroText, unknown>>;
    const editedStages = Array.isArray(edited.stages) ? edited.stages : [];
    return {
        topLine: text(edited.topLine) || defaults.topLine,
        startButton: text(edited.startButton) || defaults.startButton,
        finalButton: text(edited.finalButton) || defaults.finalButton,
        stages: defaults.stages.map((base, i) => {
            const stage = (editedStages[i] ?? {}) as Partial<Record<keyof HeroStage, unknown>>;
            return {
                label: text(stage.label) || base.label,
                title: text(stage.title) || base.title,
                accent: text(stage.accent) || base.accent,
                detail: text(stage.detail) || base.detail,
            };
        }),
    };
}

// Lays edited words over a block of default text. The defaults decide the shape: lists keep their length and
// order, and only strings are taken from the edit. An empty, missing or wrongly typed value keeps the default.
export function mergeText<T>(defaults: T, raw: unknown): T {
    if (typeof defaults === "string") return (text(raw) || defaults) as T;
    if (Array.isArray(defaults)) {
        const edited = Array.isArray(raw) ? raw : [];
        return defaults.map((base, i) => mergeText(base, edited[i])) as T;
    }
    if (defaults && typeof defaults === "object") {
        const edited = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
        return Object.fromEntries(Object.entries(defaults).map(([key, base]) => [key, mergeText(base, edited[key])])) as T;
    }
    return defaults;
}
