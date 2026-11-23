// Fails when dashboard code uses colours outside the Bordeaux theme:
// raw Tailwind palette classes (bg-slate-900, text-blue-500, bg-white ...) and hex literals that are not theme colours.
// Marketing pages carry their own kit (.ph-*) and are skipped. Add `palette-ok` on a line to allow it on purpose.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const SKIP_DIR = /(components\/marketing|app\/\(marketing\))/;
const MARKETING = new Set(['about', 'blog', 'careers', 'contact', 'data-deletion', 'docs', 'faq', 'google-api-disclosure', 'help', 'industries', 'locations', 'pricing', 'privacy', 'products', 'regions', 'security', 'support', 'terms', 'trust', 'vs', 'api', 'p']);
// Third-party brand marks (sign-in buttons, payment provider tiles) keep their own colours.
const BRAND_FILE = /(google|linkedin|whatsapp|stripe|razorpay)/i;
// PublishedLandingRenderer draws customers' own landing pages with their own themes, not the app theme.
const SKIP_FILE = new Set(['NavBar.tsx', 'Footer.tsx', 'PublishedLandingRenderer.tsx']);
// Legacy module UIs nothing imports (not rendered anywhere). Left as is; delete them rather than restyle them.
const UNUSED_FILE = new Set(['PricingPage.tsx', 'JobStatusList.tsx', 'NotificationCenter.tsx', 'CrmSettings.tsx', 'ContentGenerator.tsx', 'VariantStats.tsx', 'CriteriaBuilder.tsx', 'ICPListPage.tsx', 'ICPCard.tsx', 'BillingPage.tsx', 'Sparkline.tsx', 'OrgGraph.tsx']);
const THEME_HEX = new Set(['5C1A2B', '74253A', '3A0E1A', '2E0C15', 'F3EDE4', 'E8DFD2', 'FBF8F3', '1A1414', '2A2220', '8C7B6B', '6E5F52', 'C2A36B', 'DCC392', 'A8884F', '5B6B3A', 'B7862E', 'A63D2F', '4A4040', 'B5677A', '241C1C', '2A2120', '3A2C2A', '3D302C', 'BFB2A3', '9DB06E', 'D9AE5C', 'D06A5B', 'C9BBB0', 'DCCFB8', 'EADFC9']);

const FAMILIES = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const UTIL = 'bg|text|border|ring|from|via|to|fill|stroke|shadow|divide|outline|decoration|placeholder|accent|caret';
const PALETTE_CLASS = new RegExp(String.raw`(?<![\w-])(?:${UTIL})-(?:(?:${FAMILIES})-\d{2,3}|white|black)(?![\w-])`);
const HEX = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (p.endsWith('.tsx')) yield p;
  }
}

function inScope(p) {
  const rel = path.relative(root, p).split(path.sep).join('/');
  const parts = rel.split('/');
  if (SKIP_DIR.test(rel)) return false;
  if (!['app', 'components', 'modules'].includes(parts[0])) return false;
  if (parts[0] === 'app' && MARKETING.has(parts[1])) return false;
  const base = path.basename(p);
  if (SKIP_FILE.has(base) || UNUSED_FILE.has(base) || BRAND_FILE.test(base)) return false;
  return !(base.endsWith('.test.tsx') || rel.includes('__tests__'));
}

const problems = [];
for (const file of walk(root)) {
  if (!inScope(file)) continue;
  readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
    if (line.includes('palette-ok')) return;
    const cls = line.match(PALETTE_CLASS);
    if (cls) problems.push(`${path.relative(root, file)}:${i + 1}  palette class "${cls[0]}"`);
    for (const m of line.matchAll(HEX)) {
      const hex = m[1].length === 8 ? m[1].slice(0, 6) : m[1];
      if (!THEME_HEX.has(hex.toUpperCase())) problems.push(`${path.relative(root, file)}:${i + 1}  hex "${m[0]}" is not a theme colour`);
    }
  });
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\nlint:colors found ${problems.length} problem(s). Use theme tokens (bg-primary, text-muted-foreground, hsl(var(--chart-1))...) or add "palette-ok" on a line that must keep a fixed colour.`);
  process.exit(1);
}
console.log('lint:colors ok');
