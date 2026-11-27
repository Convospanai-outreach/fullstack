import fs from 'fs';
import path from 'path';

export interface LocationData {
  slug: string;
  name: string;
  state: string;
  stateCode: string;
  placename: string;
  position: string;
  icbm: string;
  latitude: string;
  longitude: string;
  corridors: string[];
  industryFocus: string[];
  summary: string;
}

const locationsDirectory = path.join(process.cwd(), 'content/locations');

const TEXT_FIELDS = ['slug', 'name', 'state', 'stateCode', 'placename', 'position', 'icbm', 'latitude', 'longitude', 'summary'] as const;
const LIST_FIELDS = ['corridors', 'industryFocus'] as const;

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';
const isList = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');

// Each hub is a JSON file written in the CMS. A file that is not valid, or lacks a field the pages need, is
// left out so one bad edit cannot take the locations pages down.
export function loadLocations(directory: string = locationsDirectory): LocationData[] {
  if (!fs.existsSync(directory)) return [];

  const entries: { order: number; location: LocationData }[] = [];
  for (const file of fs.readdirSync(directory).filter((f) => f.endsWith('.json'))) {
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
    } catch {
      continue;
    }
    if (!TEXT_FIELDS.every((f) => isText(raw[f])) || !LIST_FIELDS.every((f) => isList(raw[f]))) continue;

    const order = Number(raw['order']);
    const { order: _order, ...location } = raw;
    entries.push({ order: Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER, location: location as unknown as LocationData });
  }

  return entries.sort((a, b) => a.order - b.order || a.location.slug.localeCompare(b.location.slug)).map((e) => e.location);
}

export const CITIES_MATRIX: LocationData[] = loadLocations();

export function getLocationBySlug(slug: string): LocationData | undefined {
  return CITIES_MATRIX.find(c => c.slug.toLowerCase() === slug.toLowerCase());
}
