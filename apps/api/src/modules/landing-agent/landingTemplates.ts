import { z } from "zod";
import { readFileSync } from "node:fs";
import { encodeLeadFormMarkerId, leadFormConfigSchema, LEAD_FORM_MARKER_CLASS } from "./leadFormConfig";
import { absoluteLandingAssetUrls, landingAppOrigin, LANDING_APP_ORIGIN_FALLBACK } from "./landingAssetUrls";

// The helpers live in landingAssetUrls.ts (no file reads there, so the publish service can import them).
export { absoluteLandingAssetUrls, landingAppOrigin, LANDING_APP_ORIGIN_FALLBACK };


// Editor-ready page templates for the "Start from a template" gallery. The JSON file is the
// source of truth; apps/web/src/components/landing-agent/landingTemplates.json and
// apps/web/tests/fixtures/landing-templates.json are copies that a test keeps identical.
// Templates store relative built-in image paths and a {{LEAD_FORM}} token. Creating a page
// swaps the token for the encoded lead form marker and makes image URLs absolute.

export const LANDING_FORM_TOKEN = "{{LEAD_FORM}}";

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

export function materializeLandingTemplate(
  template: LandingTemplate,
  origin: string | null,
): { html: string; css: string } {
  const marker = `<div class="${LEAD_FORM_MARKER_CLASS}" id="${encodeLeadFormMarkerId(template.leadForm)}"></div>`;
  return { html: absoluteLandingAssetUrls(template.html.replace(LANDING_FORM_TOKEN, marker), origin), css: "" };
}
