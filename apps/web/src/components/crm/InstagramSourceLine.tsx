"use client";

// Where a lead came from on Instagram: the keyword auto-reply that created or was merged into it.
// Shape matches GET /leads/:id (instagramSource) from apps/api, read as plain data.
export type InstagramLeadSource = {
    triggerId: string;
    keyword: string | null;
    contentPostId: string | null;
    postTitle: string | null;
    platform: string;
};

export function instagramSourceText(source: InstagramLeadSource): string {
    const parts = ["From Instagram:"];
    if (source.keyword) parts.push(`keyword ${source.keyword}`);
    if (source.postTitle) parts.push(`${source.keyword ? "on" : ""} post ${source.postTitle}`.trim());
    return parts.join(" ");
}

export default function InstagramSourceLine({ source }: { source: InstagramLeadSource | null | undefined }) {
    if (!source) return null;
    return <p className="text-sm text-muted-foreground">{instagramSourceText(source)}</p>;
}
