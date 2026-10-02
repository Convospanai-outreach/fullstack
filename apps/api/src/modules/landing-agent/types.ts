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
    title: string;
    description: string;
    framework: string;
    sections: LandingPageSection[];
}
