// Pure helpers for the editor's Instagram follow button. The link is built only from a handle that
// passes the handle rules in leadFormConfig.ts, so no other text reaches the page's href.
import { instagramHandleProblem, instagramProfileUrl, isValidInstagramHandle } from "@/modules/landing-agent/leadFormConfig";

export const INSTAGRAM_FOLLOW_CLASS = "la-instagram";
// Not an account: the phone check asks for a handle until the panel replaces this link.
export const INSTAGRAM_PLACEHOLDER_HREF = "#set-instagram-handle";

// The block the editor inserts: a call-to-action link to the placeholder profile, set in the settings panel.
export function instagramFollowBlockContent(): string {
  return `
<section class="la-section">
    <a class="la-cta ${INSTAGRAM_FOLLOW_CLASS}" href="${INSTAGRAM_PLACEHOLDER_HREF}" target="_blank" rel="noopener noreferrer">Follow us on Instagram</a>
</section>`;
}

// The profile link for a typed handle, or the reason it cannot be used.
export function instagramBlockHref(handle: string): { href: string } | { problem: string } {
  const href = instagramProfileUrl(handle);
  if (href) return { href };
  return { problem: instagramHandleProblem(handle) ?? "Enter a valid Instagram handle" };
}

// True only for the profile link the panel builds: https://www.instagram.com/<handle>/ with a valid handle.
export function isInstagramProfileHref(href: string): boolean {
  const match = /^https:\/\/www\.instagram\.com\/([^/?#]+)\/$/.exec(href);
  return match !== null && isValidInstagramHandle(match[1]);
}

// True when a selected component is an Instagram follow button (by its class only).
export function instagramFollowOfSelection(classes: string[]): boolean {
  return classes.includes(INSTAGRAM_FOLLOW_CLASS);
}
