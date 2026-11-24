import { test, expect } from '@playwright/test';

// The public site must resolve the shared design tokens without an authenticated session.
const ROUTES = ['/', '/pricing', '/industries/cybersecurity'];
const THEMES = ['light', 'dark'] as const;
const WIDTHS = [1440, 390];
const BACKGROUND = { light: 'rgb(243, 237, 228)', dark: 'rgb(26, 20, 20)' };

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    for (const route of ROUTES) {
      test(`global css: ${route} ${theme} ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript((t) => {
          try { localStorage.setItem('theme', t); } catch { /* storage blocked */ }
        }, theme);
        await page.goto(route, { waitUntil: 'networkidle' });

        const result = await page.evaluate(() => {
          const parse = (s: string) => {
            const m = s.match(/rgba?\(([^)]+)\)/);
            if (!m) return null;
            const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
            return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
          };
          const hsl = (c: { r: number; g: number; b: number }) => {
            const r = c.r / 255, g = c.g / 255, b = c.b / 255;
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
            if (d === 0) return null;
            const l = (mx + mn) / 2, s = d / (1 - Math.abs(2 * l - 1));
            const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
            return { h: (h * 60 + 360) % 360, s };
          };
          const cool: string[] = [];
          document.querySelectorAll('body *').forEach((el) => {
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') return;
            for (const prop of ['color', 'backgroundColor', 'borderTopColor'] as const) {
              const c = parse(cs[prop]);
              if (!c || c.a < 0.3) continue;
              if (prop === 'borderTopColor' && cs.borderTopWidth === '0px') continue;
              const x = hsl(c);
              if (x && x.s > 0.25 && x.h >= 165 && x.h <= 290) cool.push(`${el.tagName} ${prop} ${cs[prop]}`);
            }
          });
          return {
            font: getComputedStyle(document.body).fontFamily,
            background: getComputedStyle(document.body).backgroundColor,
            overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
            cool: cool.slice(0, 5),
          };
        });

        expect(result.font).toContain('Montserrat');
        expect(result.background).toBe(BACKGROUND[theme]);
        expect(result.overflowX, 'page scrolls sideways').toBe(false);
        expect(result.cool, 'blue/violet/cyan colours found').toEqual([]);
      });
    }
  }
}
