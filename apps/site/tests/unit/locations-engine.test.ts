import { describe, expect, it } from 'vitest';
import { CITIES_MATRIX, getLocationBySlug } from '../../src/lib/locations';
import sitemap from '../../src/app/sitemap';
import robots from '../../src/app/robots';

describe('Local Geo-Targeting Engine (10-City Matrix)', () => {
  it('defines all 10 required Indian commercial cities with valid state codes and coordinates', () => {
    expect(CITIES_MATRIX).toHaveLength(10);

    const expectedSlugs = [
      'gurugram', 'delhi', 'noida', 'mumbai', 'bengaluru',
      'hyderabad', 'pune', 'chennai', 'kolkata', 'ahmedabad'
    ];

    expectedSlugs.forEach((slug) => {
      const city = getLocationBySlug(slug);
      expect(city).toBeDefined();
      expect(city?.slug).toBe(slug);
      expect(city?.stateCode).toMatch(/^IN-[A-Z]{2}$/);
      expect(city?.position).toContain(';');
      expect(city?.icbm).toContain(',');
      expect(Number(city?.latitude)).toBeGreaterThan(0);
      expect(Number(city?.longitude)).toBeGreaterThan(0);
      expect(city?.corridors.length).toBeGreaterThan(0);
      expect(city?.industryFocus.length).toBeGreaterThan(0);
    });
  });

  it('correctly retrieves city by slug regardless of case', () => {
    const gurugram = getLocationBySlug('GURUGRAM');
    expect(gurugram).toBeDefined();
    expect(gurugram?.name).toBe('Gurugram');

    const invalid = getLocationBySlug('non-existent-city');
    expect(invalid).toBeUndefined();
  });

  it('includes /locations hub and all 10 city landing pages in sitemap.ts', () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls.some((u) => u.endsWith('/locations'))).toBe(true);

    CITIES_MATRIX.forEach((city) => {
      expect(urls.some((u) => u.endsWith(`/locations/${city.slug}`))).toBe(true);
    });
  });

  it('allows /locations crawling in robots.ts AI crawler rules', () => {
    const result = robots();
    const rulesList = Array.isArray(result.rules) ? result.rules : [result.rules];
    const aiRule = rulesList.find((r) => Array.isArray(r.userAgent) && r.userAgent.includes('GPTBot'));
    expect(aiRule).toBeDefined();

    const allowed = Array.isArray(aiRule?.allow) ? aiRule?.allow : [aiRule?.allow];
    expect(allowed).toContain('/locations');
  });
});
