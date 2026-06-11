export const CMF_MESSAGE_TYPES = {
  captureVisibleProfile: "CMF_CAPTURE_VISIBLE_PROFILE",
  storeVisibleProfile: "CMF_STORE_VISIBLE_PROFILE",
  getLastCapture: "CMF_GET_LAST_CAPTURE",
  debugProfileCapture: "CMF_DEBUG_PROFILE_CAPTURE",
  v2ApiCaptureDisabled: "CMF_V2_API_CAPTURE_DISABLED"
} as const;

export type CMFMessageType = typeof CMF_MESSAGE_TYPES[keyof typeof CMF_MESSAGE_TYPES];

export function getV2DisabledResponse() {
  return {
    ok: false,
    disabled: true,
    message: "LinkedIn API-assisted capture is prepared but disabled in V1 approval build."
  };
}
