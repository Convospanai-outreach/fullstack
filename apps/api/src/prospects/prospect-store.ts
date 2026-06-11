import type { CMFProspect } from "./prospect.types";

export interface ProspectStore {
  getLastCapture(): CMFProspect | null;
  storeLastCapture(prospect: CMFProspect): CMFProspect;
}

export class InMemoryProspectStore implements ProspectStore {
  private lastCapture: CMFProspect | null = null;

  getLastCapture(): CMFProspect | null {
    return this.lastCapture;
  }

  storeLastCapture(prospect: CMFProspect): CMFProspect {
    this.lastCapture = prospect;
    return prospect;
  }
}
