import { describe, expect, it } from "vitest";
import { LinkedInRequestRecorder } from "../request-recorder";

describe("LinkedInRequestRecorder", () => {
  it("classifies likely LinkedIn profile and search endpoints", () => {
    const recorder = new LinkedInRequestRecorder();

    expect(recorder.classifyUrl("https://www.linkedin.com/voyager/api/graphql?queryId=voyagerIdentityDashProfiles")).toBe("graphql");
    expect(recorder.classifyUrl("https://www.linkedin.com/voyager/api/identity/profiles/jane")).toBe("identity");
    expect(recorder.classifyUrl("https://www.linkedin.com/voyager/api/search/blended")).toBe("search");
    expect(recorder.classifyUrl("https://www.linkedin.com/salesApiPeopleSearch?q=x")).toBe("sales_people_search");
    expect(recorder.classifyUrl("https://www.linkedin.com/salesApiLeadSearch?q=x")).toBe("sales_lead_search");
  });

  it("does not store requests while V2 capture is disabled", () => {
    const recorder = new LinkedInRequestRecorder();

    expect(recorder.record({
      url: "https://www.linkedin.com/voyager/api/graphql",
      headers: {
        cookie: "li_at=secret",
        authorization: "Bearer secret",
        accept: "application/json"
      }
    })).toBeNull();
    expect(recorder.getEntries()).toEqual([]);
  });
});
