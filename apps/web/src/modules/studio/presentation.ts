export type Channel = "email" | "deck";

export type StudioConfig = {
    formality: number;
    directness: number;
    talkingPoints: string;
    avoidWords: string;
    language: string;
    market: string;
    audience: string;
    campaignObjective: string;
    audienceNeeds: string;
    deckTitle: string;
    presentationGoal: string;
    slideOutline: string;
    contentRequirements: string;
};

export type StudioSlide = {
    index: number;
    title: string;
    body: string;
};

export type LanguageMeta = {
    value: string;
    label: string;
    nativeLabel: string;
    direction: "ltr" | "rtl";
    region: string;
    signal: string;
};

export const LANGUAGES: LanguageMeta[] = [
    { value: "en-US", label: "English (US)", nativeLabel: "English", direction: "ltr", region: "North America", signal: "Direct, commercial, proof-led" },
    { value: "en-GB", label: "English (UK)", nativeLabel: "English", direction: "ltr", region: "United Kingdom", signal: "Polished, measured, lower hype" },
    { value: "fr-FR", label: "French", nativeLabel: "Francais", direction: "ltr", region: "France / Europe", signal: "Structured, precise, context-first" },
    { value: "de-DE", label: "German", nativeLabel: "Deutsch", direction: "ltr", region: "DACH", signal: "Specific, credible, detail-oriented" },
    { value: "es-ES", label: "Spanish", nativeLabel: "Espanol", direction: "ltr", region: "Spain / LATAM-ready", signal: "Clear, warm, relationship-aware" },
    { value: "ar-AE", label: "Arabic", nativeLabel: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629", direction: "rtl", region: "Middle East", signal: "Right-to-left, formal, trust-sensitive" },
    { value: "hi-IN", label: "Hindi", nativeLabel: "\u0939\u093f\u0928\u094d\u0926\u0940", direction: "ltr", region: "India", signal: "Executive clarity with local nuance" },
    { value: "ja-JP", label: "Japanese", nativeLabel: "\u65e5\u672c\u8a9e", direction: "ltr", region: "Japan", signal: "Reserved, respectful, consensus-aware" },
];

const FALLBACK_LANGUAGE: LanguageMeta = LANGUAGES[0]!;

export const MARKETS = [
    "North America",
    "United Kingdom",
    "Europe",
    "Middle East",
    "India",
    "Southeast Asia",
    "APAC Enterprise",
    "Global",
];

export const DEFAULT_STUDIO_CONFIG: StudioConfig = {
    formality: 72,
    directness: 44,
    talkingPoints: "Mention measurable business impact\nReference the campaign promise\nMatch the audience maturity level",
    avoidWords: "cheap, hack, guaranteed, spammy",
    language: "en-US",
    market: "Global",
    audience: "Revenue leaders at mid-market SaaS teams",
    campaignObjective: "Book first meetings for a multilingual product launch campaign",
    audienceNeeds: "They need concise proof, market-sensitive language, and a deck they can adapt for stakeholders.",
    deckTitle: "International Launch Narrative",
    presentationGoal: "Give the prospect team a clean executive-ready storyline they can localize fast.",
    slideOutline: "1. Market context and trigger\n2. Audience pain points by region\n3. Product fit and message map\n4. Local proof points and objections\n5. Call to action and next step",
    contentRequirements: "Keep language editable, avoid slang, show regional nuance, and make each slide easy to rewrite for local teams.",
};

function toMultilineString(value: unknown, fallback: string) {
    if (Array.isArray(value)) {
        return value
            .map((item) => String(item).trim())
            .filter(Boolean)
            .join("\n") || fallback;
    }

    if (typeof value === "string" && value.trim()) {
        return value;
    }

    return fallback;
}

function toCommaSeparatedString(value: unknown, fallback: string) {
    if (Array.isArray(value)) {
        return value
            .map((item) => String(item).trim())
            .filter(Boolean)
            .join(", ") || fallback;
    }

    if (typeof value === "string" && value.trim()) {
        return value;
    }

    return fallback;
}

export function normalizeStudioConfig(raw: unknown): StudioConfig {
    if (!raw || typeof raw !== "object") {
        return DEFAULT_STUDIO_CONFIG;
    }

    const source = raw as Partial<Record<keyof StudioConfig, unknown>>;

    return {
        formality: typeof source.formality === "number" ? source.formality : DEFAULT_STUDIO_CONFIG.formality,
        directness: typeof source.directness === "number" ? source.directness : DEFAULT_STUDIO_CONFIG.directness,
        talkingPoints: toMultilineString(source.talkingPoints, DEFAULT_STUDIO_CONFIG.talkingPoints),
        avoidWords: toCommaSeparatedString(source.avoidWords, DEFAULT_STUDIO_CONFIG.avoidWords),
        language: typeof source.language === "string" && source.language ? source.language : DEFAULT_STUDIO_CONFIG.language,
        market: typeof source.market === "string" && source.market ? source.market : DEFAULT_STUDIO_CONFIG.market,
        audience: typeof source.audience === "string" && source.audience ? source.audience : DEFAULT_STUDIO_CONFIG.audience,
        campaignObjective: typeof source.campaignObjective === "string" && source.campaignObjective ? source.campaignObjective : DEFAULT_STUDIO_CONFIG.campaignObjective,
        audienceNeeds: typeof source.audienceNeeds === "string" && source.audienceNeeds ? source.audienceNeeds : DEFAULT_STUDIO_CONFIG.audienceNeeds,
        deckTitle: typeof source.deckTitle === "string" && source.deckTitle ? source.deckTitle : DEFAULT_STUDIO_CONFIG.deckTitle,
        presentationGoal: typeof source.presentationGoal === "string" && source.presentationGoal ? source.presentationGoal : DEFAULT_STUDIO_CONFIG.presentationGoal,
        slideOutline: typeof source.slideOutline === "string" && source.slideOutline ? source.slideOutline : DEFAULT_STUDIO_CONFIG.slideOutline,
        contentRequirements: typeof source.contentRequirements === "string" && source.contentRequirements ? source.contentRequirements : DEFAULT_STUDIO_CONFIG.contentRequirements,
    };
}

export function getLanguageMeta(value: string) {
    return LANGUAGES.find((item) => item.value === value) ?? FALLBACK_LANGUAGE;
}

export function getLanguageLabel(value: string) {
    return getLanguageMeta(value).label;
}

export function isRtlLanguage(value: string) {
    return getLanguageMeta(value).direction === "rtl";
}

export function listFromMultiline(value: string) {
    return value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
}

export function listFromCommaSeparated(value: string) {
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

export function buildDeckSlides(slideOutline: string): StudioSlide[] {
    return slideOutline
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => {
            const cleaned = line.replace(/^\d+[\).\s-]*/, "").trim();
            const parts = cleaned.split(":");
            const title = (parts[0] || `Slide ${index + 1}`).trim();
            const body = (
                parts.slice(1).join(":") ||
                "Adapt this slide for the target market, buying committee, and proof required for the campaign."
            ).trim();

            return { index: index + 1, title, body };
        });
}

export function buildDeckPreview(config: StudioConfig) {
    const slides = buildDeckSlides(config.slideOutline);

    return `Deck title: ${config.deckTitle}
Language: ${getLanguageLabel(config.language)}
Market: ${config.market}
Audience: ${config.audience}
Goal: ${config.presentationGoal}

Slide plan:
${slides.map((slide) => `${slide.index}. ${slide.title}\n   ${slide.body}`).join("\n")}

Audience needs:
${config.audienceNeeds}

Content requirements:
${config.contentRequirements}`;
}

export function buildCampaignPreview(config: StudioConfig) {
    return `Language: ${getLanguageLabel(config.language)}
Market: ${config.market}
Audience: ${config.audience}
Campaign objective: ${config.campaignObjective}

Hi {{firstName}},

I am reaching out with a campaign tailored for ${config.market} teams like ${config.audience}.

We are focusing on ${listFromMultiline(config.talkingPoints)[0] || "your highest-priority business outcome"} while keeping the language editable for local teams and stakeholder requirements.

If useful, I can also share a localized deck outline for ${config.deckTitle}.

Best,
{{senderName}}`;
}

export function slugifyPresentationName(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "international-campaign-deck";
}

export function buildPresentationNotes(config: StudioConfig, preview?: string) {
    const language = getLanguageMeta(config.language);
    const talkingPoints = listFromMultiline(config.talkingPoints);
    const avoidWords = listFromCommaSeparated(config.avoidWords);

    return [
        `Language: ${language.label} (${language.nativeLabel})`,
        `Region: ${language.region}`,
        `Direction: ${language.direction.toUpperCase()}`,
        `Market: ${config.market}`,
        `Audience: ${config.audience}`,
        `Campaign objective: ${config.campaignObjective}`,
        `Audience needs: ${config.audienceNeeds}`,
        `Presentation goal: ${config.presentationGoal}`,
        `Talking points: ${talkingPoints.join("; ") || "None supplied"}`,
        `Avoid words: ${avoidWords.join(", ") || "None supplied"}`,
        `Content requirements: ${config.contentRequirements}`,
        preview ? `Working copy: ${preview}` : "",
    ]
        .filter(Boolean)
        .join("\n");
}
