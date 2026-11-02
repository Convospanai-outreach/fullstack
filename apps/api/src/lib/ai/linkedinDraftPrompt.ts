// The prompts behind LinkedIn outreach drafts (connection note and follow-up). They live here, apart
// from aiService and the sequence handler, so the prompt registry can render and fingerprint them.

export function buildConnectionPrompt(profileContext: string): string {
    return `Write a concise LinkedIn connection message (max 300 characters) based on this profile context:\n${profileContext}`;
}

export function buildFollowUpPrompt(context: string): string {
    return `Write a short, professional LinkedIn follow-up message. Context: ${context}`;
}
