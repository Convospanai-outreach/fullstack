import { z } from "zod";

const pictureArtifactSchema = z.object({
  fileIdentifyingUrlPathSegment: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional()
});

export const linkedInPictureSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    rootUrl: z.string().optional(),
    artifacts: z.array(pictureArtifactSchema).optional(),
    displayImageReference: z.object({
      vectorImage: linkedInPictureSchema.optional()
    }).optional()
  }).passthrough()
);

export const miniProfileSchema = z.object({
  publicIdentifier: z.string().optional(),
  entityUrn: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  headline: z.string().optional(),
  occupation: z.string().optional(),
  picture: linkedInPictureSchema.optional(),
  profilePicture: linkedInPictureSchema.optional()
}).passthrough();

export const dashProfileSchema = z.object({
  publicIdentifier: z.string().optional(),
  entityUrn: z.string().optional(),
  memberIdentity: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  fullName: z.string().optional(),
  headline: z.string().optional(),
  occupation: z.string().optional(),
  locationName: z.string().optional(),
  geoLocationName: z.string().optional(),
  profilePicture: linkedInPictureSchema.optional()
}).passthrough();

export const cmfProspectSchema = z.object({
  source: z.literal("linkedin"),
  profileUrl: z.string(),
  publicIdentifier: z.string().optional(),
  entityUrn: z.string().optional(),
  linkedinId: z.string().optional(),
  memberId: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  fullName: z.string().optional(),
  headline: z.string().optional(),
  occupation: z.string().optional(),
  companyName: z.string().optional(),
  location: z.string().optional(),
  profilePicture: z.string().optional(),
  captureMethod: z.enum(["visible_dom", "title_meta_fallback", "linkedin_api_payload"]),
  capturedAt: z.string()
});
