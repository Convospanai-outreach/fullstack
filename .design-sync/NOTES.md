# design-sync notes — CraftMyFunnel UI

## Repo shape
This is NOT a standalone design-system package. The synced components live inside
`apps/web/src/components/` (19 files in `ui/`, 11 top-level layout/marketing files),
part of the `craftmyfunnel-full-scaffold` Next.js monorepo app. There is no
`package.json`, build step, `.d.ts`, or Storybook for them on their own — this sync
scaffolds all of that locally under `.design-sync/pkg/`:

- `.design-sync/pkg/src/index.ts` re-exports the real component files (by real
  relative path — no code is copied/duplicated).
- `.design-sync/pkg/src/stubs/` — `next/link`, `next/image`, `next/navigation`, and
  `@clerk/nextjs` are aliased (via esbuild `--alias`) to tiny local stand-ins so
  these Next.js/Clerk-coupled components render standalone. `useAuth()` reports a
  signed-in user; `usePathname()` returns `/`; `Link`/`Image` become plain `<a>`/`<img>`.
- `.design-sync/pkg/src/stubs/process-shim.ts` is `esbuild --inject`ed because
  `ui/CommandPalette.tsx` reads `process.env['NEXT_PUBLIC_API_URL']` directly —
  Next.js normally inlines this at build time; a plain esbuild bundle has no
  `process` global without the shim.
- `.design-sync/pkg/build.sh` reruns all of this (esbuild bundle → `tsc` for
  `.d.ts` → the flat `dist/index.d.ts` re-export shim → the Tailwind compile).
  Re-run it (or let the resync driver run `cfg.buildCmd`) before any re-sync.
- `.design-sync/pkg/compile-tw.mjs` compiles `apps/web/src/app/globals.css`
  (Tailwind v4, real `@theme` tokens) via `@tailwindcss/postcss` + `postcss` into
  `.design-sync/pkg/dist/tailwind-compiled.css`, wired as `cfg.cssEntry`. It scans
  the whole `apps/web/src` tree (`source("../")` in globals.css), so it's a
  faithful (large, ~350KB) snapshot of the app's real compiled utility set.

## `package.json` "types" field gotcha — the actual bug that cost the most time
`tsc`'s declaration output mirrors the **common ancestor** of every file it
touches. Because `componentSrcMap` points at real files living far outside
`.design-sync/pkg/` (in `apps/web/src/components/`), tsc emits
`dist/.design-sync/pkg/src/index.d.ts`, not a flat `dist/index.d.ts`. The
converter's ts-morph project only scans `dirname(pkgJson.types)/**/*.d.ts` — if
`types` had pointed at that deep path directly, ts-morph would only see 5 files
and every extracted prop type would silently degrade to `[key: string]: unknown`
(no error, just a bad contract). Fix: `dist/index.d.ts` is a **flat one-line
shim** (`export * from './.design-sync/pkg/src/index';`), and `package.json`
`types` points at that shim — so `dirname(types)` is `dist/`, and the glob picks
up the whole tree (34 files, real props resolved). `build.sh` rewrites this shim
on every build; if `package.json`'s `types` field is ever "fixed" back to the
nested path, prop extraction silently breaks again.

## `GlassCard` name collision
`apps/web/src/components/ui/GlassCard.tsx` and `apps/web/src/components/GlassCard.tsx`
are two unrelated components with the same name. The `ui/` one is exported as
`GlassCard` (group: Primitives); the top-level one is exported as
`MarketingGlassCard` (group: Layout) via `componentSrcMap`/`docsMap`. This is a
naming choice made for this sync, not something in the source repo — if the real
components are ever renamed, update `.design-sync/pkg/src/index.ts` and
`cfg.componentSrcMap`/`cfg.docsMap` together.

## Real bugs found in the app (not sync artifacts — reported, not silently fixed)
- **`bg-accent-blue` / `text-brand-*` / `bg-surface-*` compile to nothing.**
  `apps/web/tailwind.config.js` defines `theme.extend.colors.accent/brand/surface/text`
  as nested objects, but this repo's Tailwind v4 setup has no `@config` directive
  anywhere (checked `globals.css` and `postcss.config.js`) — v4 only reads a JS
  config when explicitly told to via `@config`. So every class built from those
  nested keys is dead. `ui/PrimaryButton.tsx` uses `bg-accent-blue` and renders
  with an invisible background/text as a direct result — graded `needs-work`
  with this note rather than papered over. **This is very likely repo-wide**,
  not limited to `PrimaryButton` — worth a real fix (either wire `@config` or
  move those colors into `@theme`).
- **`ui/GlassCard.tsx`'s only class, `clerk-card`, is defined nowhere** (grepped
  `globals.css` and all of `apps/web/src`). The component renders as bare
  unstyled text. Graded `needs-work` with this note.
- Two smaller, cosmetic (not fixed, not blocking): `GlowButton`'s `glow` class
  and `FeatureGrid`'s `section` class also don't resolve to anything, and
  `Modal`'s `border-border-subtle`/`text-text-secondary` — `border-subtle` isn't
  a real nested key under `border` in the Tailwind config (only `text.secondary`
  resolves, since `text` *is* a proper nested object there). None of these
  visibly broke their component's usability in the previews authored.

## Known render warns (triaged, not new on a re-sync)
- `Modal` and `MobileMenu` are `position: fixed` full-viewport overlays. The
  capture harness's own per-cell label bar can overlap the top ~40px of fixed
  content during solo capture (`[RENDER_THIN]` / cropped screenshot) — this is a
  harness/fixed-position interaction, confirmed benign: the actual rendered
  component (verified via the raw screenshots) is fully styled and complete.
  Graded `good` with a note rather than reworked, per the skill's own guidance
  for this exact symptom.
- `LogoMark` (`apps/web/src/components/brand/LogoMark.tsx`, used inside `Header`,
  `Footer`, `NavBar`) requests an absolute `/craftmyfunnel-logo.png` path. This
  isn't servable by the local preview static server, and won't be servable in
  claude.ai/design either (the upload plan only ships `components/**`,
  `tokens/**`, `fonts/**`, `_vendor/**`, `_preview/**`, `guidelines/**`, and the
  bundle/CSS/README — not arbitrary root image assets). Shows as a small broken
  image icon next to the wordmark in `Header`/`Footer`/`NavBar`; everything else
  in those previews renders correctly. Not fixable from the sync side without
  either vendoring the logo as a font/asset-capability upload or changing
  `LogoMark` to accept an injected src.
- `NavBar`'s desktop nav groups are `hidden lg:flex` (1024px breakpoint) —
  required `viewport: "1100x140"` in `cfg.overrides.NavBar`, not the initial
  900px guess, or the whole desktop nav silently disappears.
- `Footer`'s 5-column grid needs `md:` (768px) width to lay out correctly;
  initially tried `cardMode: "column"` (narrower) which produced an overlapping
  2-col fallback — switched to `cardMode: "single"` with an explicit
  `viewport: "1000x520"`.

## Re-sync risks
- The Tailwind compile (`compile-tw.mjs`) re-scans the **entire** `apps/web/src`
  tree on every rebuild (inherited from `globals.css`'s own `source("../")`) —
  it will pick up new utility classes from completely unrelated parts of the
  app, and its ~350KB size will grow with the app. If that becomes a problem,
  narrow the `source(...)` scope in a copy of `globals.css` rather than editing
  the app's real file.
- `dtsPropsFor` was **not** written for every generic-fallback component
  (`CommandPalette`, `Header`, `Footer`, `FeatureGrid`, `GlowButton`,
  `NavBar`, `SectionTitle`, `NotificationBell`, `Dialog`'s root, `Tabs`'s root,
  `Tooltip`'s root, `DropdownMenu`'s root — anything typed via
  `React.ComponentPropsWithoutRef<typeof RadixPrimitive.X>` without `@radix-ui`
  types loaded into the ts-morph project) — their `.d.ts` is the honest
  `{[key: string]: unknown}` fallback rather than a hand-authored contract.
  Functionally fine (previews still work via real JSX), but the design agent's
  prop autocomplete for these will be weak. Worth hand-writing `dtsPropsFor` for
  the ones used most if this DS gets iterated on.
- 36 subcomponents (`CardHeader`, `DialogContent`, `DropdownMenuItem`, etc.) are
  on the floor card by design — only the 30 top-level components the user
  explicitly scoped in were authored. Authorable incrementally on any re-sync.
- If `apps/web/src/components/ui/GlassCard.tsx` or `PrimaryButton.tsx` are fixed
  upstream (the two `needs-work` bugs above), their preview should be re-graded
  — nothing about the previews themselves needs to change, just the grade.
