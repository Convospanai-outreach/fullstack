// Friendly search term -> OpenStreetMap tags. There is deliberately no catch-all: a term
// without a mapping is reported as unsupported, because a generic fallback such as
// office=company returns mostly junk. OSM maps physical premises, so the list favours
// storefront businesses.

export type OsmTag = { key: string; value: string };

export type OsmArea = { lat: number; lon: number; radiusMeters: number };

export const SUPPORTED_TERMS: Readonly<Record<string, readonly OsmTag[]>> = {
    dentist: [{ key: "amenity", value: "dentist" }],
    clinic: [{ key: "amenity", value: "clinic" }],
    doctor: [{ key: "amenity", value: "doctors" }],
    pharmacy: [{ key: "amenity", value: "pharmacy" }],
    hospital: [{ key: "amenity", value: "hospital" }],
    veterinary: [{ key: "amenity", value: "veterinary" }],
    restaurant: [{ key: "amenity", value: "restaurant" }],
    cafe: [{ key: "amenity", value: "cafe" }],
    school: [{ key: "amenity", value: "school" }],
    bakery: [{ key: "shop", value: "bakery" }],
    hardware: [{ key: "shop", value: "hardware" }],
    optician: [{ key: "shop", value: "optician" }],
    salon: [{ key: "shop", value: "hairdresser" }, { key: "shop", value: "beauty" }],
    furniture: [{ key: "shop", value: "furniture" }],
    electronics: [{ key: "shop", value: "electronics" }],
    "car repair": [{ key: "shop", value: "car_repair" }],
    gym: [{ key: "leisure", value: "fitness_centre" }],
    hotel: [{ key: "tourism", value: "hotel" }],
    lawyer: [{ key: "office", value: "lawyer" }],
    accountant: [{ key: "office", value: "accountant" }],
    "estate agent": [{ key: "office", value: "estate_agent" }],
    architect: [{ key: "office", value: "architect" }],
    "insurance agent": [{ key: "office", value: "insurance" }],
    carpenter: [{ key: "craft", value: "carpenter" }],
    electrician: [{ key: "craft", value: "electrician" }],
    plumber: [{ key: "craft", value: "plumber" }],
};

// Plural and spacing variants people type, folded onto the keys above.
const ALIASES: Readonly<Record<string, string>> = {
    dentists: "dentist", "dental clinic": "dentist", clinics: "clinic", doctors: "doctor",
    pharmacies: "pharmacy", chemist: "pharmacy", hospitals: "hospital", vet: "veterinary", vets: "veterinary",
    restaurants: "restaurant", cafes: "cafe", schools: "school", bakeries: "bakery",
    "hardware store": "hardware", opticians: "optician", salons: "salon", "beauty salon": "salon",
    "furniture store": "furniture", "electronics store": "electronics", garage: "car repair",
    gyms: "gym", hotels: "hotel", lawyers: "lawyer", accountants: "accountant",
    "real estate agent": "estate agent", architects: "architect", carpenters: "carpenter",
    electricians: "electrician", plumbers: "plumber",
};

export type ResolvedTerm =
    | { ok: true; term: string; tags: readonly OsmTag[] }
    | { ok: false; reason: "unsupported_term"; term: string };

export function resolveTerm(input: string): ResolvedTerm {
    const folded = input.trim().toLowerCase().replace(/\s+/g, " ");
    const key = SUPPORTED_TERMS[folded] ? folded : ALIASES[folded];
    const tags = key ? SUPPORTED_TERMS[key] : undefined;
    return key && tags ? { ok: true, term: key, tags } : { ok: false, reason: "unsupported_term", term: input };
}

const MAX_RADIUS_METERS = 50_000;
const SAFE_TAG = /^[a-z_:]+$/;

// Overpass QL for every element (node, way, relation) carrying one of the tags within the
// radius. The [timeout:N] makes the server stop the query; "out tags center" returns tags
// and a single point per element and no geometry.
export function buildOverpassQuery(tags: readonly OsmTag[], area: OsmArea, timeoutSeconds = 25): string {
    const { lat, lon, radiusMeters } = area;
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
        throw new Error("Invalid coordinates for an OSM search.");
    }
    if (!Number.isFinite(radiusMeters) || radiusMeters <= 0 || radiusMeters > MAX_RADIUS_METERS) {
        throw new Error(`An OSM search radius must be between 1 and ${MAX_RADIUS_METERS} metres.`);
    }
    for (const { key, value } of tags) {
        if (!SAFE_TAG.test(key) || !SAFE_TAG.test(value)) throw new Error("Unexpected characters in an OSM tag.");
    }
    const around = `(around:${Math.round(radiusMeters)},${lat},${lon})`;
    const lines = tags.map(({ key, value }) => `  nwr["${key}"="${value}"]${around};`);
    return `[out:json][timeout:${Math.round(timeoutSeconds)}];\n(\n${lines.join("\n")}\n);\nout tags center;`;
}
