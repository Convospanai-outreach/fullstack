import type { CMFProspect } from "./prospect.types";

export type FutureEnrichmentProvider =
  | "backend_enrichment"
  | "apollo"
  | "people_data_labs"
  | "proxycurl"
  | "netjana_signals";

export interface FutureEnrichmentRequest {
  provider: FutureEnrichmentProvider;
  prospect: CMFProspect;
}

export interface FutureEnrichmentResult {
  provider: FutureEnrichmentProvider;
  matched: boolean;
  confidence: number;
  fields: Partial<CMFProspect>;
}
