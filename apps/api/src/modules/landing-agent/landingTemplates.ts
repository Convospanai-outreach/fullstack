import { z } from "zod";
import { readFileSync } from "node:fs";
import { encodeLeadFormMarkerId, leadFormConfigSchema, LEAD_FORM_MARKER_CLASS } from "./leadFormConfig";

// Editor-ready page templates for the "Start from a template" gallery. The JSON file is the
// source of truth; apps/web/src/components/landing-agent/landingTemplates.json and
// apps/web/tests/fixtures/landing-templates.json are copies that a test keeps identical.
// Templates store relative built-in image paths and a {{LEAD_FORM}} token. Creating a page
// swaps the token for the encoded lead form marker and makes image URLs absolute.

export const LANDING_FORM_TOKEN = "{{LEAD_FORM}}";

// The canonical origin the web app uses for absolute links, with the same fallback as its metadataBase.
export const LANDING_APP_ORIGIN_FALLBACK = "https://craftmyfunnel.live";

const templateSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(60),
    name: z.string().min(1).max(60),
    audience: z.string().min(1).max(200),
    description: z.string().min(1).max(240),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    imageVariants: z.array(z.string().regex(/^\/landing-assets\/gradient-[1-8]\.svg$/)).min(2).max(3),
    html: z
      .string()
      .min(1)
      .max(20000)
      .refine((html) => html.split(LANDING_FORM_TOKEN).length === 2, "exactly one form token is needed"),
    leadForm: leadFormConfigSchema,
  })
  .strict();

export type LandingTemplate = z.infer<typeof templateSchema>;

// Read at load time (not an import) so the file is served by the same path in tsx and in tests.
const rawTemplates: unknown = JSON.parse(readFileSync(new URL("./landingTemplates.json", import.meta.url), "utf8"));

export const LANDING_TEMPLATES: readonly LandingTemplate[] = z.array(templateSchema).parse(rawTemplates);

export function getLandingTemplate(id: string): LandingTemplate | undefined {
  return LANDING_TEMPLATES.find((template) => template.id === id);
}

// The origin that stored image URLs use, or null to keep them relative (plain http, local development).
// Reads the same variables as the web app's canonical origin, in the same order.
export function landingAppOrigin(env: Record<string, string | undefined>): string | null {
  const configured = env["NEXT_PUBLIC_SITE_URL"] || env["NEXTAUTH_URL"];
  if (!configured) return LANDING_APP_ORIGIN_FALLBACK;
  try {
    const url = new URL(configured);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function materializeLandingTemplate(
  template: LandingTemplate,
  origin: string | null,
): { html: string; css: string } {
  const marker = `<div class="${LEAD_FORM_MARKER_CLASS}" id="${encodeLeadFormMarkerId(template.leadForm)}"></div>`;
  return { html: absoluteLandingAssetUrls(template.html.replace(LANDING_FORM_TOKEN, marker), origin), css: "" };
}

// Built-in image paths (/landing-assets/...) made absolute on the app origin, so they load on a connected domain.
// Relative paths stay as they are when there is no https origin (local development).
export function absoluteLandingAssetUrls(html: string, origin: string | null): string {
  if (!origin) return html;
  return html.replace(/src="\/landing-assets\//g, `src="${origin}/landing-assets/`);
}
