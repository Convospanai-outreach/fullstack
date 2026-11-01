// Editor blocks for the rest of the Landing category: testimonial, FAQ, pricing, image with text, button,
// divider and the Instagram follow button. Every block is a <section> built from classes in
// LANDING_PAGE_BASE_CSS, with no script, inline style, form or extra tag, so the sanitizer keeps it unchanged
// (apps/api/src/modules/landing-agent/landingBlocksMarkup.test.ts checks it). Placeholder copy makes no claims.
import { instagramFollowBlockContent } from "./instagramFollow";

export interface LandingBlock {
  id: string;
  label: string;
  content: string;
}

export const LANDING_BLOCKS: readonly LandingBlock[] = [
  {
    id: "testimonial",
    label: "Testimonial",
    content: `
<section class="la-section la-testimonial">
    <p class="la-eyebrow">Customer story</p>
    <h2>Customer quote goes here</h2>
    <p>Replace this with a real quote from a customer.</p>
    <p><strong>Customer name</strong>, Role at Company</p>
</section>`,
  },
  {
    id: "faq",
    label: "FAQ",
    content: `
<section class="la-section">
    <h2>Frequently asked questions</h2>
    <div class="la-faq-item">
        <h3>Question one?</h3>
        <p>Answer to question one.</p>
    </div>
    <div class="la-faq-item">
        <h3>Question two?</h3>
        <p>Answer to question two.</p>
    </div>
</section>`,
  },
  {
    id: "pricing",
    label: "Pricing (two plans)",
    content: `
<section class="la-section">
    <h2>Plans</h2>
    <div class="la-pricing">
        <div class="la-plan">
            <h3>Plan name</h3>
            <p>Your price</p>
            <ul>
                <li>What this plan includes</li>
                <li>Another included item</li>
            </ul>
            <a class="la-cta" href="#lead-form">Choose this plan</a>
        </div>
        <div class="la-plan">
            <h3>Plan name</h3>
            <p>Your price</p>
            <ul>
                <li>What this plan includes</li>
                <li>Another included item</li>
            </ul>
            <a class="la-cta" href="#lead-form">Choose this plan</a>
        </div>
    </div>
</section>`,
  },
  {
    id: "image_text",
    label: "Image and text",
    content: `
<section class="la-section la-image-text">
    <img src="/landing-assets/gradient-2.svg" alt="Abstract header image" loading="lazy">
    <div>
        <h2>Heading for this section</h2>
        <p>Explain what the image shows and why it matters to the reader.</p>
    </div>
</section>`,
  },
  {
    id: "button",
    label: "Button",
    content: `
<section class="la-section">
    <a class="la-cta" href="#lead-form">Button text</a>
</section>`,
  },
  {
    id: "divider",
    label: "Divider",
    content: `
<section class="la-section la-divider"></section>`,
  },
  {
    id: "instagram_follow",
    label: "Instagram follow",
    content: instagramFollowBlockContent(),
  },
];
