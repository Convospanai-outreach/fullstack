import { describe, expect, it } from "vitest";
import { CMF_MESSAGE_TYPES, getV2DisabledResponse } from "../message-router";

describe("extension message router", () => {
  it("exposes V1 message names and disabled V2 response", () => {
    expect(CMF_MESSAGE_TYPES.captureVisibleProfile).toBe("CMF_CAPTURE_VISIBLE_PROFILE");
    expect(CMF_MESSAGE_TYPES.storeVisibleProfile).toBe("CMF_STORE_VISIBLE_PROFILE");
    expect(CMF_MESSAGE_TYPES.getLastCapture).toBe("CMF_GET_LAST_CAPTURE");
    expect(CMF_MESSAGE_TYPES.debugProfileCapture).toBe("CMF_DEBUG_PROFILE_CAPTURE");
    expect(getV2DisabledResponse()).toEqual({
      ok: false,
      disabled: true,
      message: "LinkedIn API-assisted capture is prepared but disabled in V1 approval build."
    });
  });
});
