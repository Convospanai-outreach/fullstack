export const FEATURE_FLAGS = {
  visibleProfileCapture: true,
  linkedinApiCapture: false,
  backendLeadSync: false,
  outreachAutomation: false,
  messageDrafting: false,
  connectionAutomation: false
} as const;

export type FeatureFlags = typeof FEATURE_FLAGS;
