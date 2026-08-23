# Handoff: CraftMyFunnel Marketing Homepage — Broadsheet Redesign

## Overview
A full redesign of the CraftMyFunnel marketing homepage (currently `apps/web/src/app/marketing-home-page.tsx`, dark glassmorphism/violet-cyan gradient look) into the **Broadsheet** editorial design system: newsprint serif type on paper-white, no boxes/cards for layout, hierarchy from type scale and whitespace, with CraftMyFunnel's own indigo/violet/gold brand family (from `apps/web/tailwind.config.js`) standing in for Broadsheet's default cyan/magenta process inks.

Same content and sections as the live site (hero, buyer-signal stats, product/dashboard preview, NetJana signals, 4-part platform architecture, industries served, pilot CTA, footer) — new visual language.

## About the Design Files
The files in `source/` are **design references built as an HTML prototype** (a "Design Component" — a single streaming HTML file used by the design tool, not a framework artifact). They show the intended layout, type, color, spacing and copy. They are **not production code to copy into the app** — implement this design in the existing Next.js/Tailwind/React codebase (`apps/web`), using the app's own component patterns (`@/components/ui/*`, the existing `Button`, page structure under `src/app/`), not by embedding the HTML file.

`source/CraftMyFunnel Landing.dc.html` — the full prototype. Open it in a browser to see the live look; view source for exact markup/inline styles.
`source/broadsheet-styles.css` — the Broadsheet design-system stylesheet (token source of truth: colors, ramps, spacing, component classes `.btn`, `.tag`, `.table`, `.nav`, `.cmyk-num`, `.cmyk-head`, etc.)
`source/print-plates.js` — SVG filter defs for the CMYK color-separation effects (`.cmyk`, `.cmyk-num`, `.cmyk-head`). Only needed if you keep the plate-separation headline/numeral treatment.
`source/broadsheet-theme.json` — machine-readable token dump backing the CSS above.

## Fidelity
**High-fidelity.** Every color, type size, spacing value and piece of copy below is final — implement pixel-for-pixel using the target codebase's styling approach (Tailwind classes/CSS variables), not a rough guide.

## Design Tokens

### Colors (CraftMyFunnel brand family standing in for Broadsheet's accents)
| Token | Hex | Use |
|---|---|---|
| `--color-bg` | `#f3f2f2` | Page background (paper) |
| `--color-surface` | `#eae9e9` | Input/surface fill |
| `--color-text` | `#201e1d` | Body ink |
| `--color-divider` | `color-mix(#201e1d 16%, transparent)` | Hairlines only (rules, table borders) — never used to box sections |
| `--color-accent` (primary, indigo) | `#6366f1` | Primary buttons, links, interactive states, spot numerals |
| `--color-accent-600` | `#4f46e5` | Primary button hover |
| `--color-accent-700` | `#4338ca` | Kickers, small accent text on paper, pressed state, link hover |
| `--color-accent-100..900` ramp | `#f5f7ff → #ebf0fe → #ced9fd → #818cf8 → #6366f1 → #4f46e5 → #4338ca → #38318e → #312e81` | Tints/pressed states |
| `--color-accent-2` (secondary, violet) | `#8b5cf6` | Rare second spot color (Editorial hero variant, CMYK magenta plate) |
| `--color-accent-2-100..900` ramp | `#ede9fe → #ddd6fe → #c4b5fd → #a78bfa → #8b5cf6 → #7c3aed → #6d28d9 → #5b21b6 → #4c1d95` | Tints/text-on-tint |
| `--color-process-yellow` | `#fbbf24` (brand gold) | Third CMYK separation plate only — never interface chrome |

Rule: cyan-family (indigo) accent for all interactive elements; violet used small and rare (one hero variant, one plate color). Never both accents in one small component (e.g. don't color a button border violet and its icon indigo).

### Typography
- `--font-heading` / `--font-body`: **Source Serif 4** (Google Font), weight 600 for headings, 400 for body and true italic (never synthetic oblique).
- Body base: 15–19px / line-height 1.55–1.65.
- H1 (hero): `clamp(42px, 6vw, 74px)`, line-height 1.08, letter-spacing -0.02em.
- H2 (section heads): `clamp(30px, 3.6vw, 44px)`, line-height 1.15, letter-spacing -0.015em.
- H3 (card/column titles): 18–20px.
- Kickers/eyebrows: 13px, letter-spacing 0.08em, uppercase, ink at 70% opacity (or `--color-accent-700` when the kicker is itself the accent line).
- Pull quotes: italic Source Serif 4, `clamp(22px, 2.4vw, 30px)`, line-height 1.5.

### Spacing
Section vertical padding 56–96px (hero 96/64, footer close 64/96). Content max-width 1200px, side gutters `clamp(20px, 5vw, 72px)`. Grid gaps 24–40px depending on column count (3–4 col feature grids).

### Components used (from Broadsheet, `broadsheet-styles.css`)
- `.nav` / `.nav-brand` — header bar, no border, brand left, links, CTA button right.
- `.btn.btn-primary` — solid indigo fill, ink-on-accent text (`--color-bg` on `--color-accent`), radius `--radius-md` (2px).
- `.btn.btn-secondary` — outlined, divider-color border.
- `.input` — 36px min-height, surface fill, divider border, focus ring in accent.
- `.table` — plain themed data table (no card wrapper) for the "lead journey" preview.
- `.tag.tag-accent` — small pill label, accent-100 bg / accent-800 text.
- `.cmyk-num` — display numerals (used for the "01–04" platform-architecture markers) rendered as 3 misregistered process plates (cyan/violet/gold) over a paper-colored union — see `print-plates.js`/CSS for the exact construction (`.paper` + 3× `.plate` spans, `mix-blend-mode: multiply`).
- `.cmyk-head` — same plate construction, recut for headline-scale text sitting in normal flow (no padding/ground fill). Used on one line of the hero headline in two of the three color/type variants below.

## Screens / Views

Single scrolling page, in this order:

### 1. Nav
Sticky is **not** used (Broadsheet doesn't do dark chrome/blur bars) — plain top bar, paper background, no border. Brand wordmark "CraftMyFunnel" left; links **Product** (`#workflow`), **Use Cases** (`#industries`), **Platform** (`#platform`), **Join Pilot** (`#pilot`); right-aligned **Login** link + **Request Invite** primary button.

### 2. Hero
No card, no gradient background, no floating glass widgets. Two decorative touches only: a small halftone-dot field (radial-gradient dot pattern, ink at ~22% opacity, masked to fade from the top-right corner) and a small registration-mark crosshair (circle + crosshair SVG, ink at ~40% opacity) bottom-left — both `aria-hidden`, purely decorative, echoing the print-shop furniture Broadsheet decks use at section breaks.

Headline, two lines, each its own block:
- Line 1: "Every lead keeps moving."
- Line 2: "Nothing falls through unapproved."

Sub-copy: "CraftMyFunnel gives B2B service teams one governed workspace for outreach — drafted, approved, sent and tracked across email, LinkedIn and calls. The outcome: nothing slips, and nobody has to ask."

CTAs: **Request Invite** (primary) + **See how it works** (secondary/outline), row, 15px gap.
Trust line beneath (toggleable — see Tweaks): "Gmail + SMTP connected · LinkedIn profile sync · Every action human-approved · Sovereign edge optional" — 13px uppercase, tracked, muted ink.

**Three color/type pairing variants** (this was the exploration deliverable — pick one, or keep as a theme switch):
- **Wire** (default): small uppercase kicker above the headline ("Governed outreach for B2B service teams"); both headline lines plain ink except line 2, which takes the `.cmyk-head` plate treatment (indigo/violet/gold separation); sub-copy roman; stat spot-numeral in indigo (`--color-accent-700`).
- **Editorial**: no kicker; line 1 takes the `.cmyk-head` plate treatment, line 2 is plain and colored violet (`--color-accent-2-700`); sub-copy italic; stat spot-numeral in violet.
- **Quiet**: no kicker; both headline lines plain ink, no plate effect at all (most restrained); sub-copy italic; stat spot-numeral stays indigo, but it's the only color note in the whole hero.

### 3. Stats strip (front-page furniture)
A thick/thin double rule (2px ink over 1px ink, 5px gap) opens the block, a single hairline closes it — this is the *one* place Broadsheet prints rules; never elsewhere. Between the rules, a 4-column row of label + dotted leader + figure ("index" style):
- Actions sent without approval → **0** (accent-colored, the variant's spot color)
- Channels in one funnel → **4**
- Days before a quiet lead resurfaces → **15**
- Weeks to first governed campaign → **4**

### 4. Product/workflow preview
Kicker "Guided Growth Workflow" (accent-700) → H2 "One view. Everyone aligned. No status-update meetings." → sub-copy → a plain `.table` (no card/shadow wrapper) with columns Account / Signal / Score / Status and 4 rows: Titan Facilities/Expansion/92/Review, NorthStar Security/Hiring/87/Ready, Urban Estates/Procurement/81/Caller, MetroWorks/Tender/78/Queued. (No product screenshot — the dashboard is represented as real typeset data, per Broadsheet's "no boxes" rule.)

### 5. Pull quote
Italic Source Serif blockquote, max-width 640px: "One activity timeline, one view. No 'did anyone follow up on this?' conversations." — attributed "— from the CraftMyFunnel workflow."

### 6. NetJana buyer signals
Kicker "NetJana · Buyer Signals" → H2 "Buyer signals before your competitors notice them." → sub-copy → 4-column feature list (no cards, justified body copy with hyphenation): Hiring Expansion, Tender Activity, Facility Expansion, Technology Adoption, each with a one-sentence description (see source file for exact copy).

### 7. How it works
Kicker "How it works" → H2 "From first signal to booked meeting — every step is governed." → 4-column numbered steps (Step 1–4: Import or capture leads / Draft, then approve / Sync full context / Advance, deliberately), each with a short description.

### 8. Platform architecture (4-part)
Kicker "The CMF Ecosystem" → H2 "Four components. One governed funnel, not a CRM." → 4-column grid, each column: a large `.cmyk-num` plate numeral (01–04), H3 title (NetJana / CMF Core / Human Layer / Covospan EDGE), a `.tag.tag-accent` label (Buyer Signals / AI Outreach / Conversion Moat / Sovereign Edge), one-sentence description.

### 9. Industries served
H2 "Built for industries where a missed follow-up costs a contract." → sub-copy → 3-column list (no cards): Facility Management, Security Services, Staffing, each with a one-sentence description.

### 10. Pilot / invite close
H2 "Join the pilot. Run your first governed campaign in 4 weeks." → sub-copy → 4-column week index (Week 1 Signal Setup / Week 2 Qualification Rules / Week 3 Multi-Channel Outreach / Week 4 Qualified Meetings) → email input + **Request Invite** primary button, no card wrapper.

### 11. Footer
Plain, top hairline divider only. Left: brand + copyright + `support@craftmyfunnel.live` mailto link. Right: Privacy Policy / Terms & Conditions / Support / Security links.

## Interactions & Behavior
- Standard Broadsheet interaction states apply throughout (already in `broadsheet-styles.css`, don't reinvent): `.btn-primary` hover → `--color-accent-600`, active → `--color-accent-700`; links use `--color-accent`, hover `--color-accent-700` with underline; `:focus-visible` → 2px accent outline everywhere (never the browser default ring).
- No animations/transitions in this design — Broadsheet is a static, editorial page. If the target app's motion system requires entrance animation, keep it a plain fade/slide, not the current site's blob/gradient motion.
- Responsive: at ≤1080px, 4-column grids should drop to 2 columns; at ≤720px, drop to 1 column and stack the hero decorations off (or reduce their size) since the gutter narrows below the point they read cleanly.

## State Management
Static marketing page — no client state beyond the email-capture input's value and the existing invite-request submission logic already implemented in `InviteRequestForm`. Reuse that component's submit handler; only the visual shell changes.

## Assets
No photography or icon assets used — this design deliberately avoids screenshots/mockups (per Broadsheet's "no boxes, no dark surfaces" rule) in favor of real typeset data (the stats strip, the lead-journey table). No new image assets to source. If Phosphor icons are wanted for the nav or CTAs (Broadsheet's icon set), they aren't used in this design — the original page's lucide-react icons were dropped entirely in favor of typographic hierarchy.

## Files
- `source/CraftMyFunnel Landing.dc.html` — full prototype (open in a browser; view source for exact markup/inline styles per section)
- `source/broadsheet-styles.css` — design-system tokens + component CSS
- `source/print-plates.js` — CMYK separation filter defs (needed only if implementing the plate-numeral/plate-headline effect)
- `source/broadsheet-theme.json` — token values in JSON

Reference in the existing repo: `apps/web/src/app/marketing-home-page.tsx` (current implementation to replace), `apps/web/src/app/page.tsx` (route entry), `apps/web/tailwind.config.js` (brand color source), `apps/web/src/components/marketing/InviteRequestForm.tsx` (reuse as-is), `apps/web/src/components/brand/LogoMark.tsx` (reuse as-is).
