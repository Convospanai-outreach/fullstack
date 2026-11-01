import { afterEach, describe, expect, it, vi } from "vitest";
import { landingAgentApi } from "./landingAgentApi";

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("landingAgentApi instant confirmation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("PUTs {enabled, sequenceId} to the page's instant-confirmation route", async () => {
    const fetchMock = stubFetch({ id: "page-1" });
    await landingAgentApi.saveInstantConfirmation("camp-1", "page-1", { enabled: true, sequenceId: "seq-1" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/proxy/landing-agent/campaigns/camp-1/pages/page-1/instant-confirmation");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ enabled: true, sequenceId: "seq-1" });
  });

  it("GETs the sequences that can be used for instant confirmation", async () => {
    const list = [{ id: "seq-1", name: "Welcome", channel: "email" }];
    const fetchMock = stubFetch(list);
    expect(await landingAgentApi.listInstantConfirmationSequences()).toEqual(list);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit | undefined];
    expect(url).toBe("/api/proxy/landing-agent/instant-confirmation/sequences");
    expect(init?.method ?? "GET").toBe("GET");
  });

  it("surfaces the API error message when the save is refused", async () => {
    stubFetch({ error: "Pick a sequence with exactly one active step." }, 400);
    await expect(
      landingAgentApi.saveInstantConfirmation("camp-1", "page-1", { enabled: true, sequenceId: "seq-1" })
    ).rejects.toThrow("Pick a sequence with exactly one active step.");
  });
});
