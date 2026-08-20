## CraftMyFunnel UI conventions

This is a subset of a larger Next.js app (`apps/web`) — shadcn/Radix primitives plus a handful of dark-themed marketing/layout components. No wrapper provider is required; every component here works standalone.

### Styling idiom: Tailwind utility classes + CSS variable tokens

Style with Tailwind utility classes directly on JSX, the same way the source components do (`className="rounded-md border bg-card px-4 py-2"`). Semantic color tokens are CSS custom properties consumed through Tailwind's `bg-*`/`text-*`/`border-*` utilities — real, working names:

| Utility | Token |
|---|---|
| `bg-background` / `text-foreground` | page background / default text |
| `bg-card` / `text-card-foreground` | card surfaces |
| `bg-primary` / `text-primary-foreground` | primary actions (buttons, links) |
| `bg-secondary`, `bg-muted`, `bg-accent`, `bg-destructive` (+ `-foreground`) | secondary surfaces, muted text, hover accents, destructive actions |
| `border-border`, `border-input`, `ring-ring` | borders and focus rings |
| `rounded-lg` / `rounded-md` / `rounded-sm` | derived from `--radius` |

Merge conditional classes with `cn(...)` (clsx + tailwind-merge) the way `Button`/`Badge`/`Card` do internally — you won't have this helper available, but compose classes in the same additive style it produces (base classes, then variant classes, then a caller override last).

**Known dead classes — do not use these:** `bg-accent-blue`, `text-brand-*`, `bg-surface-*` (and similar `accent`/`brand`/`surface`/`text` nested-object color names from `tailwind.config.js`) compile to nothing in this build — Tailwind v4 only reads that JS config via an explicit `@config` directive, which this repo doesn't have. `PrimaryButton` uses `bg-accent-blue` and renders with an invisible background/text as a result; treat it as a real bug, not a pattern to copy. Stick to the token table above, which is wired through `@theme` in `globals.css` and does work.

Dark surfaces (`GlassCard`, `HeaderBanner`, `Skeleton`, `StatBlock`, marketing sections) use a `.glass`/`.glass-premium`-style translucent panel meant to sit on a **dark background** (`#020617`/`#0f172a`-ish) — on a light page they read as flat/invisible. When composing with these, wrap them in a dark container.

### Where the truth lives

Read `styles.css` (imports `_ds_bundle.css`, the compiled Tailwind output) for the full utility/token vocabulary, and each component's own `.prompt.md` / `.d.ts` for its exact prop shape — those are extracted from the real shipped types, not hand-written.

### Example

```tsx
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from "<pkg>";

<Card className="max-w-sm">
  <CardHeader>
    <CardTitle>Weekly outreach report</CardTitle>
  </CardHeader>
  <CardContent className="flex items-center justify-between">
    <Badge variant="success">Active</Badge>
    <Button size="sm">View report</Button>
  </CardContent>
</Card>
```
