// Pure text, no database import, so prompt builders and the prompt registry can render it.

// Appended to a draft prompt only when an audience block exists.
export const AUDIENCE_RULES =
    "Use this only to pick the angle, vocabulary, structure and level of formality. Write in the spelling and date style of the prospect's location when one is given, and keep the formality normal for business email there. " +
    "If the location is not known, write in neutral international English. Match the communication style when one is given, but never name or hint at a personality type, DISC, or any profiling. " +
    "Do not mention the prospect's country, region, nationality, religion or culture unless the Signal does. No stereotypes and no assumptions about the person beyond these facts. Do not say the prospect fits the target audience.";

export function renderAudienceSection(audience?: string): string {
    return audience ? `## AUDIENCE\n${audience}\n${AUDIENCE_RULES}\n\n` : "";
}
