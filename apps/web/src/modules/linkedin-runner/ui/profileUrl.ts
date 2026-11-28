// The runner test acts on a profile the operator names; this accepts only a linkedin.com/in/ profile URL.
export function toRunnerProfileUrl(input: string): string | null {
    const raw = input.trim();
    if (!raw) return null;
    let url: URL;
    try {
        url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
        return null;
    }
    const host = url.hostname.toLowerCase();
    if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return null;
    const match = url.pathname.match(/^\/in\/([^/]+)\/?$/);
    if (!match) return null;
    return `https://www.linkedin.com/in/${match[1]}`;
}
