// CTA button blocks for the editor's Landing category. Pure data and markup, no GrapesJS import.
// Every button is an <a class="la-cta"> that points at the in-page lead form. The variants use
// classes from LANDING_PAGE_BASE_CSS only: no inline style, no script. The sanitizer keeps this
// markup unchanged (apps/api/src/modules/landing-agent/ctaMarkup.test.ts checks it).

export const CTA_PRESET_TEXTS = [
  "Get the free guide",
  "Send it to my DMs",
  "Yes, show me how",
  "Reserve my seat",
  "Claim the offer",
  "Book my free call",
  "Show me the checklist",
] as const;

export const CTA_MICRO_COPY = "No spam. Unsubscribe any time.";

// Editor-only. Shown as the block's label in the Blocks panel, never in the published HTML.
export const OFFER_END_HINT = "Only use this if it is true.";

export interface CtaBlock {
  id: string;
  label: string;
  content: string;
}

const FORM_LINK = "#lead-form";
const DEFAULT_TEXT = CTA_PRESET_TEXTS[0];

function button(text: string, classes: string): string {
  return `<a class="${classes}" href="${FORM_LINK}">${text}</a>`;
}

function presetId(text: string): string {
  return `cta_preset_${text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
}

const PRESET_BLOCKS: CtaBlock[] = CTA_PRESET_TEXTS.map((text) => ({
  id: presetId(text),
  label: text,
  content: `<section class="la-section">${button(text, "la-cta")}</section>`,
}));

export const CTA_BLOCKS: readonly CtaBlock[] = [
  ...PRESET_BLOCKS,
  {
    id: "cta_outline",
    label: "Outline button",
    content: `<section class="la-section">${button(DEFAULT_TEXT, "la-cta la-cta-outline")}</section>`,
  },
  {
    id: "cta_mobile_full",
    label: "Big full-width button (mobile)",
    content: `<section class="la-section">${button(DEFAULT_TEXT, "la-cta la-cta-mobile-full")}</section>`,
  },
  {
    id: "cta_micro_copy",
    label: "Button with micro-copy",
    content: `<section class="la-section"><div class="la-cta-wrap">${button(DEFAULT_TEXT, "la-cta")}<p class="la-cta-micro">${CTA_MICRO_COPY}</p></div></section>`,
  },
  {
    id: "cta_sticky_bar",
    label: "Sticky bottom bar (mobile)",
    content: `<div class="la-cta-sticky">${button(DEFAULT_TEXT, "la-cta la-cta-mobile-full")}</div>`,
  },
  {
    id: "offer_end_date",
    label: `End-of-offer date (plain text). ${OFFER_END_HINT}`,
    content: "<p>Offer ends [date]</p>",
  },
];
