export type ProspectCaptureMethod =
  | "visible_dom"
  | "title_meta_fallback"
  | "linkedin_api_payload";

export interface CMFProspect {
  source: "linkedin";
  profileUrl: string;
  publicIdentifier?: string;
  entityUrn?: string;
  linkedinId?: string;
  memberId?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  headline?: string;
  occupation?: string;
  companyName?: string;
  location?: string;
  profilePicture?: string;
  captureMethod: ProspectCaptureMethod;
  capturedAt: string;
}
