// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api/browserBase", () => ({ getBrowserApiBase: () => "/api/proxy" }));

import DraftWithAiPanel from "@/components/campaigns/sequence/DraftWithAiPanel";
import SavedProfileMarkets from "@/app/(dashboard)/icp-builder/SavedProfileMarkets";

const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe("step AI draft panel and saved ICP markets", () => {
  let container: HTMLDivElement;
  let root: Root;
  const fetchMock = vi.fn();

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  async function renderPanel(body: string, onDraft = vi.fn()) {
    await act(async () => { root.render(<DraftWithAiPanel campaignId="c1" subject="S" body={body} onDraft={onDraft} />); });
    return onDraft;
  }
  const click = (label: string) => act(async () => {
    [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(label))!.click();
  });

  it("fills the editor with the drafted subject and body, and says when the check did not run", async () => {
    fetchMock.mockReturnValue(json(200, { ok: true, subject: "New subj", body: "New body", reviewed: false }));
    const onDraft = await renderPanel("");
    await click("Draft with AI");
    await flush();
    expect(onDraft).toHaveBeenCalledWith({ subject: "New subj", body: "New body" });
    expect(container.textContent).toContain("automatic check did not run");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({});
  });

  it("sends the existing text to improve, and reports out-of-credits without changing the editor", async () => {
    fetchMock.mockReturnValue(json(402, { error: "Insufficient credits" }));
    const onDraft = await renderPanel("Existing body");
    await click("Improve with AI");
    await flush();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ existingSubject: "S", existingBody: "Existing body" });
    expect(onDraft).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Not enough credits");
  });

  it("shows the server's message when drafting fails", async () => {
    fetchMock.mockReturnValue(json(500, { ok: false, error: "Model down" }));
    await renderPanel("");
    await click("Draft with AI");
    await flush();
    expect(container.textContent).toContain("Model down");
  });

  it("saves target markets into an existing profile and keeps its other criteria", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? json(200, { ok: true })
        : json(200, { ok: true, icps: [{ id: "i1", name: "Clinics", criteria: { industry: "Health", geographies: ["India"] } }] }),
    );
    await act(async () => { root.render(<SavedProfileMarkets />); });
    await flush();
    const input = container.querySelector("input")!;
    expect(input.value).toBe("India");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "India, UAE; UK");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click("Save");
    await flush();
    const put = fetchMock.mock.calls.find((c) => c[1]?.method === "PUT")!;
    expect(put[0]).toBe("/api/proxy/icp-builder/i1");
    expect(JSON.parse(put[1].body)).toEqual({ criteria: { industry: "Health", geographies: ["India", "UAE", "UK"] } });
  });

  it("renders nothing when there are no saved profiles", async () => {
    fetchMock.mockReturnValue(json(200, { ok: true, icps: [] }));
    await act(async () => { root.render(<SavedProfileMarkets />); });
    await flush();
    expect(container.textContent).toBe("");
  });
});
