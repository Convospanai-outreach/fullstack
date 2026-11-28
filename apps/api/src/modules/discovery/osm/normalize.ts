// Overpass elements -> lead candidates. Contact tags come in two spellings (phone and
// contact:phone, and so on); the plain one wins and the other fills a gap. Fields are left
// null rather than guessed. Every candidate carries source "osm" and its OSM reference so
// OSM-derived rows can be found, attributed and exported later.
import { tryNormalizeDomain } from "../../../lib/crm/domain";
import type { OverpassElement } from "./overpassClient";

export type OsmLeadCandidate = {
    source: "osm";
    osmRef: string;
    company: string;
    phone: string | null;
    website: string | null;
    domain: string | null;
    email: string | null;
    address: string | null;
    category: string | null;
    openingHours: string | null;
    lat: number | null;
    lon: number | null;
};

function tag(tags: Record<string, string>, name: string): string | null {
    const value = (tags[name] ?? tags[`contact:${name}`] ?? "").trim();
    return value || null;
}

function address(tags: Record<string, string>): string | null {
    const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
    const parts = [street, tags["addr:city"], tags["addr:postcode"]].map(p => (p ?? "").trim()).filter(Boolean);
    return parts.length ? parts.join(", ") : null;
}

function category(tags: Record<string, string>): string | null {
    for (const key of ["amenity", "shop", "office", "craft", "leisure", "tourism"]) {
        if (tags[key]) return `${key}=${tags[key]}`;
    }
    return null;
}

function email(tags: Record<string, string>): string | null {
    const value = tag(tags, "email");
    return value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value.toLowerCase() : null;
}

export function toCandidate(element: OverpassElement): OsmLeadCandidate | null {
    const tags = element.tags ?? {};
    const company = (tags["name"] ?? tags["brand"] ?? "").trim();
    if (!company) return null;
    const website = tag(tags, "website");
    const point = element.center ?? (element.lat !== undefined && element.lon !== undefined ? { lat: element.lat, lon: element.lon } : null);
    return {
        source: "osm",
        osmRef: `${element.type}/${element.id}`,
        company,
        phone: tag(tags, "phone"),
        website,
        domain: tryNormalizeDomain(website),
        email: email(tags),
        address: address(tags),
        category: category(tags),
        openingHours: tags["opening_hours"]?.trim() || null,
        lat: point?.lat ?? null,
        lon: point?.lon ?? null,
    };
}

// First occurrence wins. Same domain = same business (branches share a website); without a
// domain, fall back to name + phone so two unrelated places with no website both survive.
export function toCandidates(elements: readonly OverpassElement[]): OsmLeadCandidate[] {
    const seen = new Set<string>();
    const out: OsmLeadCandidate[] = [];
    for (const element of elements) {
        const candidate = toCandidate(element);
        if (!candidate) continue;
        const key = candidate.domain
            ? `d:${candidate.domain}`
            : `n:${candidate.company.toLowerCase()}|${(candidate.phone ?? "").replace(/\D/g, "")}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(candidate);
    }
    return out;
}
