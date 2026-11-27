// The app's public origin for links the API puts in emails and notifications. The marketing site owns the apex
// domain, so the fallback is the app host; production sets one of these variables.
export function appBaseUrl(): string {
    const configured = process.env["NEXT_PUBLIC_APP_URL"] || process.env["WEB_BASE_URL"] || process.env["NEXTAUTH_URL"] || "https://app.craftmyfunnel.live";
    return configured.replace(/\/$/, "");
}

export const appUrl = (path: string): string => appBaseUrl() + path;
