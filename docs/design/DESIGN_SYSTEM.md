# CraftMyFunnel design system (signed-in app)

What is true in code and on the live site on 2026-11-16, plus rules for new work.
Voice: `docs/BRAND_VOICE_GUIDELINES.md`. Names: `docs/product/GLOSSARY.md`.
Sections marked **Proposed** are not approved and not in code.

## 1. Read this first: the token pipeline is half broken

The app uses Tailwind v4 (`@tailwindcss/postcss`, `@import "tailwindcss"` in
`apps/web/src/app/globals.css`). Tailwind v4 only reads `tailwind.config.js` when a CSS
file has an `@config` line. None does. So nothing in `apps/web/tailwind.config.js` applies.

Checked on craftmyfunnel.live (computed styles, 2026-11-16):

| Expected from config | What renders |
|---|---|
| Inter body font | System font stack. Inter is loaded by `next/font` but never used. |
| `text-sm` = 12.5px, `text-2xs` = 10px | `text-sm` = 14px (Tailwind default); `text-2xs` does nothing |
| `bg-brand-500` and other `brand-*` colours (about 45 uses) | Paint nothing |
| `rounded-lg` = 12px | 8px (Tailwind default). The 6px `--radius` token is not wired to any class. |
| No semibold or bold | `font-semibold` renders 600. The rule is enforced by review only. |

What does work: the colour tokens in the `@theme` block of `globals.css`
(`bg-background`, `text-foreground`, `bg-card`, `text-primary`, `text-muted-foreground`,
`border-border`, `text-success`, `text-warning`, `text-destructive`, `bg-accent`).

**Fix (needs owner OK, then visual QA of every page):** move the tokens you keep into
`@theme` in `globals.css` (font families, type scale, radius, any brand colour), then
delete `tailwind.config.js`. Do not just add `@config`: that switches on every dead value at
once (all `text-sm` shrinks to 12.5px, about 45 `brand-*` elements change colour, cards change
radius) across the whole app in one deploy.

Until fixed, new work uses only the working tokens above and Tailwind defaults.

## 2. Principles

1. Colour means something: action, done, attention, problem. Never decoration.
2. Every data section has four states: loading, empty, error, filled.
3. Numbers are real or absent. An empty state names what will appear and the next step.
4. Plain words, sentence case, one name per thing.
5. Works in light and dark, at 360px wide, by keyboard.

## 3. Colour tokens

Defined as HSL in `globals.css` (`:root` and `.dark`). Use the class, never a hex.
The live site renders dark by default.

| Token / class | Light | Dark | Use |
|---|---|---|---|
| `background` | 0 0% 100% | 222 36% 10% (navy) | Page |
| `foreground` | 240 10% 3.9% | 0 0% 98% | Main text |
| `card` | 0 0% 100% | 240 10% 6.5% / 0.6 (translucent) | Panels |
| `muted` / `secondary` / `accent` | 240 4.8% 95.9% | 240 3.7% 15.9% | Quiet fills, hover |
| `muted-foreground` | 240 3.8% 46.1% | 240 5% 64.9% | Labels, captions, empty states |
| `primary` | 221 83% 53% | 217.2 91.2% 59.8% | Links, the one main action, focus ring |
| `success` | 142 72% 29% | same | Done, approved, connected |
| `warning` | 38 92% 50% | same | Needs attention |
| `destructive` | 0 84.2% 60.2% | same | Problem, rejected, disconnect |
| `border` / `input` | 240 5.9% 90% | 0 0% 100% / 0.1 | Hairlines, inputs |

### Contrast failures (calculated against the page background, small text)

| Pair | Ratio | Needs |
|---|---|---|
| `text-success` on dark background | about 3.5 : 1 | 4.5 : 1. Lighten success in `.dark`. |
| `text-warning` on white | about 2.2 : 1 | Do not use warning as text in light mode; use it as a fill with dark text. |
| `text-destructive` on white | about 3.8 : 1 | Darken destructive in `:root`. |

Token changes go in one PR with before and after screenshots.

## 4. Type

- Renders today: system font stack (see §1). Inter, Plus Jakarta Sans and JetBrains Mono
  load but are not applied through `font-sans`; a few files use `font-jakarta` / `font-outfit`
  classes that do not exist.
- Sizes: Tailwind defaults (xs 12, sm 14, base 16, lg 18, xl 20, 2xl 24, 3xl 30 px).
- Weights: 400 and 500 only in dashboard work.
- One `h1` per page. Section titles are `h2` with `text-sm font-medium`.
- Numbers in tables use `tabular-nums`.
- Never: all-caps labels, letter-spaced eyebrows, monospace for labels, emoji in UI.

## 5. Shape and space

- Radius: use `rounded-lg` (8px today) for panels and `rounded-md` for inputs and buttons.
  Pills use `rounded-full`.
- Spacing: Tailwind default 4px scale. Page sections `space-y-6`; panel padding `p-4`/`p-5`.
- Panels: `rounded-lg border border-border bg-card`. No new glass blur, glow or gradient.
- Shadows: none on new work. Hierarchy comes from spacing and type.

## 6. Components (`apps/web/src/components/ui/`)

Inventory: avatar, badge, button, card, dialog, dropdown-menu, Input, Modal, NotificationBell,
PrimaryButton, Progress, SectionHeader, Skeleton, StatBlock, tabs, textarea, tooltip, GlassCard.

| Use | Component | Note |
|---|---|---|
| Button | `button.tsx` | `PrimaryButton.tsx` duplicates it; do not use in new work |
| Panel | `card.tsx` or plain `div` with panel classes | `GlassCard.tsx` is legacy glass; do not use in new work |
| Dialog | `dialog.tsx` | `Modal.tsx` duplicates it |
| Loading block | `Skeleton.tsx` | Same footprint as the filled state |
| Status pill | `badge.tsx` | Text always says the state; colour only supports it |

Merging duplicates is a separate task. Do not delete a component that is still imported.

## 7. Patterns

**Page header.** `h1` sentence (what needs the user, not the page name where possible),
one line of muted text under it.

**KPI strip.** Four numbers in a row, label above, value below. A metric with no data shows
a sentence and a next-step link instead of 0 (`KPIRow.tsx`).

**Needs-you queue.** Items with a count, top entries, one action. Approvals always first;
inline Approve only on approval items (`NeedsYou.tsx`).

**Empty state.** One sentence on what will appear, one link to the step that fills it.
`rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground`.
Examples: "No leads yet. Import leads" / "Email, LinkedIn and WhatsApp activity shows up here
as soon as outreach starts. Start a campaign".

**Error state.** Says it is temporary and offers Retry. A section fed by its own API may hide
instead. An outage never looks like an empty account.

**Table.** Header `text-xs text-muted-foreground`, rows split by `border-t border-border`,
wide tables inside `overflow-x-auto`, numbers right-aligned.

**Approval actions.** Order: Reject (quiet), Edit draft (secondary), Approve (primary).
After approving, say what happened and that the request cannot be reused.

## 8. Channels

- Labels exactly: Email, LinkedIn, WhatsApp, Calls.
- A channel is shown as a text label or neutral badge. Never colour alone.
- A channel with no data source shows "Not tracked yet", never 0 (`DATA_SOURCES.md`).
- Manual steps (LinkedIn, calls) are shown as rep tasks and never described as sent
  automatically (`GEMINI.md` §14).

## 9. Words

- A button says what happens: "Approve", "Import leads", "Start a campaign".
- An action keeps its name through the flow: "Approve" -> "Approved".
- No arrows or symbols as link text. No middle-dot separators in new work.
- Claims follow "Product Claim Guardrails" in `AGENTS.md`.

## 10. Access

- Real `button`, `a`, `input` with `label`. Never a clickable `div`.
- Text 4.5 : 1 in both themes (see §3 failures). Visible focus on every control.
- Icon-only buttons have `aria-label`.
- Works at 360px: nothing clipped, tables scroll in their box, menus stack.

## 11. Motion

None on page load in new work. Motion only as feedback to a user action
(opening, expanding, confirming). Respect `prefers-reduced-motion`.

## 12. Proposed, not approved

- Light blue sidebar with dark text: value not chosen. Needs a dark-theme equivalent.
- Fonts: Bricolage Grotesque for headings and large numbers, Public Sans for body.
  Only after §1 is fixed, loaded with `next/font` and wired through `@theme`.
- Merge duplicate components (§6).
