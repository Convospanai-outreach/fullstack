// Pure mobile checks for the editor's Mobile preview. Stub: real checks come next (RED step).

export type MobileCheckKind = "small_text" | "small_tap_target" | "heavy_images" | "no_lead_form";

export type MobileCheckWarning = { kind: MobileCheckKind; message: string };

export interface MobileCheckInput {
    html: string;
    css: string;
    // Byte sizes known at edit time, keyed by image src (only images uploaded in this editor session).
    imageBytes?: Record<string, number>;
}

export function mobilePageWarnings(_input: MobileCheckInput): MobileCheckWarning[] {
    return [];
}
