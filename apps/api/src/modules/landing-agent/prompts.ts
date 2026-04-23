import type { LandingBrief } from "./types";

export function buildBriefPrompt(input: {
    campaignName: string;
    prompt: string;
    framework?: string | null;
    assetText: string;
}) {
    return `
You are a B2B landing-page strategist.
Return strict JSON only with keys:
challenge, solution, benefit, framework, audience, proofPoints.

Campaign Name:
${input.campaignName}

Marketer Prompt:
${input.prompt}

Preferred Framework:
${input.framework ?? "AUTO"}

Asset Context:
${input.assetText || "None"}

Rules:
- Keep challenge/solution/benefit concise and specific.
- If framework is provided, keep it unchanged.
- audience must be an array of short audience descriptors.
- proofPoints must be an array of practical claims, avoid fabricated numbers.
`.trim();
}

export function buildWireframePrompt(input: {
    brief: LandingBrief;
    campaignName: string;
}) {
    return `
You design conversion-focused landing pages.
Return strict JSON array with exactly 3 wireframe options.
Each option keys: title, description, framework, sections.
Each section keys: id, type, heading, body, bullets, ctaLabel.

Campaign Name:
${input.campaignName}

Brief JSON:
${JSON.stringify(input.brief)}

Rules:
- Keep sections ordered from hero to conversion.
- Use only these section types:
hero, challenge_solution, pain_points, benefits, proof, logos, faq, cta_form, final_cta, footer
- Exactly 8 to 10 sections per option.
- Keep copy practical and concise.
`.trim();
}
