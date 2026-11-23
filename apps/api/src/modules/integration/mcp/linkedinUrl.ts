// The hostname must be linkedin.com or one of its subdomains. A substring check also accepts
// "linkedin.com.evil.example" and "notlinkedin.com".
export function normalizeLinkedInProfileUrl(profileUrl: string): string {
    try {
        const u = new URL(profileUrl);
        const host = u.hostname.toLowerCase();
        const onLinkedIn = host === "linkedin.com" || host.endsWith(".linkedin.com");
        if ((u.protocol !== "https:" && u.protocol !== "http:") || !onLinkedIn) throw new Error();
        return u.toString();
    } catch {
        throw new Error("Invalid LinkedIn profile URL");
    }
}
