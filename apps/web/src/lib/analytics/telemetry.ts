import { trackCustomEvent } from "@/components/analytics/GoogleAnalytics";

export type TelemetryEvent = {
  event: string;
  category?: "auth" | "billing" | "outreach" | "approval" | "system" | "admin" | undefined;
  properties?: Record<string, any> | undefined;
  userId?: string | undefined;
  teamId?: string | undefined;
  timestamp?: string | undefined;
};

/**
 * Client-side and server-safe telemetry dispatcher.
 * Dispatches events to GA4 and PostHog while maintaining privacy boundaries.
 */
export function trackTelemetry(event: TelemetryEvent) {
  const timestamp = event.timestamp || new Date().toISOString();
  const payload = {
    ...event.properties,
    category: event.category,
    team_id: event.teamId,
    client_timestamp: timestamp,
  };

  // Dispatch to Google Analytics if available in browser
  trackCustomEvent(event.event, payload);

  // Dispatch to PostHog if available in window
  if (typeof window !== "undefined" && (window as any).posthog) {
    try {
      (window as any).posthog.capture(event.event, payload);
    } catch {
      // Ignore posthog client dispatch failures
    }
  }
}

/**
 * Convenience helper for tracking key user actions.
 */
export const Telemetry = {
  login: (userId: string, method = "oauth") =>
    trackTelemetry({ event: "user_login", category: "auth", properties: { method }, userId }),

  signup: (userId: string, plan = "trial") =>
    trackTelemetry({ event: "user_signup", category: "auth", properties: { plan }, userId }),

  planSelected: (plan: string, price: number) =>
    trackTelemetry({ event: "pricing_plan_selected", category: "billing", properties: { plan, price } }),

  leadApproved: (leadId: string, teamId: string) =>
    trackTelemetry({ event: "lead_approved", category: "approval", properties: { leadId }, teamId }),

  draftGenerated: (model: string, teamId: string) =>
    trackTelemetry({ event: "draft_generated", category: "outreach", properties: { model }, teamId }),

  campaignLaunched: (campaignId: string, teamId: string) =>
    trackTelemetry({ event: "campaign_launched", category: "outreach", properties: { campaignId }, teamId }),

  adminViewAccessed: (viewName: string, userId?: string) =>
    trackTelemetry({ event: "admin_view_accessed", category: "admin", properties: { view: viewName }, userId }),
};
