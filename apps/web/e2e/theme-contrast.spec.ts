import { test, expect, type Page } from '@playwright/test';

// Dashboard theme check: each page must paint a theme-correct background in light and dark,
// keep the burgundy sidebar identical in both, and keep body text at WCAG AA contrast.
const ROUTES = ['/dashboard', '/inbox', '/campaigns', '/analytics/roi', '/settings'];
const THEMES = ['light', 'dark'] as const;

async function setTheme(page: Page, theme: (typeof THEMES)[number]) {
  await page.addInitScript((t) => {
    try { localStorage.setItem('theme', t); } catch { /* storage blocked */ }
  }, theme);
}

async function audit(page: Page) {
  return page.evaluate(() => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    const rgba = (css: string): [number, number, number, number] => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const bgOf = (el: Element): [number, number, number] => {
      let node: Element | null = el;
      while (node) {
        const c = rgba(getComputedStyle(node).backgroundColor);
        if (c[3] > 0.9) return [c[0], c[1], c[2]];
        node = node.parentElement;
      }
      return rgba(getComputedStyle(document.body).backgroundColor).slice(0, 3) as [number, number, number];
    };
    const body = rgba(getComputedStyle(document.body).backgroundColor);
    const failures: string[] = [];
    document.querySelectorAll('main h1, main h2, main p, main td, main th, main label, main a, main button, main span').forEach((el) => {
      const text = (el.textContent ?? '').trim();
      if (!text || el.children.length > 0 || !(el as HTMLElement).offsetParent) return;
      const cs = getComputedStyle(el);
      const fg = rgba(cs.color);
      const bg = bgOf(el);
      const l1 = lum([fg[0], fg[1], fg[2]]), l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const size = parseFloat(cs.fontSize);
      const large = size >= 24 || (size >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
      if (ratio < (large ? 3 : 4.5) && fg[3] > 0.5) failures.push(`${el.tagName.toLowerCase()} "${text.slice(0, 40)}" ${ratio.toFixed(2)}:1`);
    });
    const sb = document.querySelector('aside[role="navigation"]');
    return { bodyLum: lum([body[0], body[1], body[2]]), sidebar: sb ? getComputedStyle(sb).backgroundImage : '', failures };
  });
}

const sidebars: Record<string, string> = {};

for (const theme of THEMES) {
  for (const route of ROUTES) {
    test(`${route} in ${theme}: theme background, burgundy sidebar, AA text`, async ({ page }) => {
      await setTheme(page, theme);
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      const r = await audit(page);
      if (theme === 'light') expect(r.bodyLum, 'light page background should be cream').toBeGreaterThan(0.6);
      else expect(r.bodyLum, 'dark page background should be ink').toBeLessThan(0.05);
      expect(r.sidebar, 'sidebar uses the burgundy gradient').toContain('linear-gradient');
      sidebars[`${theme}:${route}`] = r.sidebar;
      expect(r.failures.slice(0, 10), 'text below WCAG AA contrast').toEqual([]);
    });
  }
}

test('sidebar gradient is identical in light and dark', async () => {
  for (const route of ROUTES) {
    const light = sidebars[`light:${route}`], dark = sidebars[`dark:${route}`];
    if (light && dark) expect(light).toBe(dark);
  }
});
