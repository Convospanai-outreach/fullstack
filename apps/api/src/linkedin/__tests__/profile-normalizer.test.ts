import { describe, expect, it } from "vitest";
import {
  cleanCompanyName,
  normalizeLinkedInProfileObject,
  normalizeLinkedInProfileUrl,
  stripLinkedInBadges
} from "../profile-normalizer";

describe("LinkedIn profile normalizer", () => {
  it("normalizes public identifiers into canonical profile URLs", () => {
    expect(normalizeLinkedInProfileUrl("jane-doe")).toBe("https://www.linkedin.com/in/jane-doe/");
    expect(normalizeLinkedInProfileUrl("https://www.linkedin.com/in/jane-doe/?miniProfileUrn=abc")).toBe(
      "https://www.linkedin.com/in/jane-doe/"
    );
  });

  it("strips LinkedIn connection badges and suffixes", () => {
    expect(stripLinkedInBadges("Jane Doe · 2nd | LinkedIn")).toBe("Jane Doe");
    expect(stripLinkedInBadges("Jane Doe 3rd connection")).toBe("Jane Doe");
  });

  it("rejects education as company", () => {
    expect(cleanCompanyName("Stanford University")).toBe("");
    expect(cleanCompanyName("CraftMyFunnel")).toBe("CraftMyFunnel");
  });

  it("normalizes safe profile objects without inferring location or education company", () => {
    const prospect = normalizeLinkedInProfileObject(
      {
        publicIdentifier: "jane-doe",
        entityUrn: "urn:li:fs_miniProfile:ACo123",
        firstName: "Jane",
        lastName: "Doe · 1st",
        headline: "Founder at CraftMyFunnel",
        companyName: "University of Somewhere",
        locationName: "Bengaluru, India",
        profilePicture: {
          rootUrl: "https://media.licdn.com/",
          artifacts: [
            { fileIdentifyingUrlPathSegment: "small.jpg", width: 100 },
            { fileIdentifyingUrlPathSegment: "large.jpg", width: 400 }
          ]
        }
      },
      { capturedAt: "2026-06-12T00:00:00.000Z" }
    );

    expect(prospect).toMatchObject({
      source: "linkedin",
      profileUrl: "https://www.linkedin.com/in/jane-doe/",
      publicIdentifier: "jane-doe",
      fullName: "Jane Doe",
      headline: "Founder at CraftMyFunnel",
      location: "Bengaluru, India",
      profilePicture: "https://media.licdn.com/large.jpg",
      captureMethod: "linkedin_api_payload"
    });
    expect(prospect.companyName).toBeUndefined();
  });
});
