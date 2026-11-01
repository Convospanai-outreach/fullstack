// Pure helpers for the editor's Instagram follow button. The link is built only from a handle that
// passes the handle rules in leadFormConfig.ts, so no other text reaches the page's href.
import { instagramHandleProblem, instagramProfileUrl } from "@/modules/landing-agent/leadFormConfig";

export const INSTAGRAM_FOLLOW_CLASS = "la-instagram";
const PLACEHOLDER_HANDLE = "yourhandle";

// The block the editor inserts: a call-to-action link to the placeholder profile, set in the settings panel.
export function instagramFollowBlockContent(): string {
  return `
<section class="la-section">
    <a class="la-cta ${INSTAGRAM_FOLLOW_CLASS}" href="https://www.instagram.com/${PLACEHOLDER_HANDLE}/" target="_blank" rel="noopener noreferrer">Follow us on Instagram</a>
</section>`;
}

// The profile link for a typed handle, or the reason it cannot be used.
export function instagramBlockHref(handle: string): { href: string } | { problem: string } {
  const href = instagramProfileUrl(handle);
  if (href) return { href };
  return { problem: instagramHandleProblem(handle) ?? "Enter a valid Instagram handle" };
}

// True when a selected component is an Instagram follow button (by its class only).
export function instagramFollowOfSelection(classes: string[]): boolean {
  return classes.includes(INSTAGRAM_FOLLOW_CLASS);
}
