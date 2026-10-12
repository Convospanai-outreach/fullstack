export interface LandingBrief {
    challenge: string;
    solution: string;
    benefit: string;
    framework: string;
    audience: string[];
    proofPoints: string[];
}

export interface LandingPageSection {
    id: string;
    type: string;
    heading?: string;
    body?: string;
    bullets?: string[];
    ctaLabel?: string;
    ctaHref?: string; // https link the button opens instead of the lead form
    imageUrl?: string;
    imagePrompt?: string;
    imageAlt?: string;
}

export interface WireframeOption {
    id: string;
    title: string;
    description?: string | null;
    framework: string;
    score: number;
    structure: LandingPageSection[];
}

// One row of the dashboard list (GET /landing-agent/campaigns).
export interface LandingCampaignSummary {
    id: string;
    name: string;
    updatedAt: string;
    pages: Array<{ slug: string; title?: string | null; status: string; updatedAt: string }>;
    _count: { wireframeOptions: number; leads: number };
}

export interface LandingCampaign {
    id: string;
    name: string;
    prompt: string;
    framework?: string | null;
    challenge?: string | null;
    solution?: string | null;
    benefit?: string | null;
    status: string;
    selectedWireframeId?: string | null;
    assets: Array<{
        id: string;
        type: string;
        sourceName?: string | null;
    }>;
    wireframeOptions: WireframeOption[];
    pages: Array<{
        id: string;
        slug: string;
        title?: string | null;
        version: number;
        status: string;
        renderedJson: unknown;
        editorState?: unknown;
    }>;
}
