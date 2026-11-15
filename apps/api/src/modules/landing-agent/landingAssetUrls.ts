// Built-in landing image URLs on the app origin. No file reads here, so the publish service can import this
// in every test environment (landingTemplates.ts reads its JSON at load time).

// The canonical origin the web app uses for absolute links, with the same fallback as its metadataBase.
export const LANDING_APP_ORIGIN_FALLBACK = "https://craftmyfunnel.live";

// The origin that stored image URLs use, or null to keep them relative (plain http, local development).
// Reads the same variables as the web app's canonical origin, in the same order.
export function landingAppOrigin(env: Record<string, string | undefined>): string | null {
  const configured = env["NEXT_PUBLIC_SITE_URL"] || env["NEXTAUTH_URL"];
  if (!configured) return LANDING_APP_ORIGIN_FALLBACK;
  try {
    const url = new URL(configured);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

// Built-in image paths (/landing-assets/...) made absolute on the app origin, so they load on a connected domain.
// Relative paths stay as they are when there is no https origin (local development).
export function absoluteLandingAssetUrls(html: string, origin: string | null): string {
  if (!origin) return html;
  return html.replace(/src="\/landing-assets\//g, `src="${origin}/landing-assets/`);
}
