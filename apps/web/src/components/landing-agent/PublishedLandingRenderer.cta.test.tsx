// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublishedLandingRenderer from "./PublishedLandingRenderer";

function ctaBodies(fetchMock: ReturnType<typeof vi.fn>): Array<{ eventName: string; eventData?: unknown }> {
  return fetchMock.mock.calls
    .filter((call) => String((call as unknown[])[0]).endsWith("/event"))
    .map((call) => JSON.parse(((call as unknown[])[1] as { body: string }).body))
    .filter((body) => body.eventName === "cta_click");
}

describe("PublishedLandingRenderer CTA click tracking", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  async function render(html: string) {
    await act(async () => {
      root.render(<PublishedLandingRenderer slug="guide" version={3} renderedJson={{ html, css: "" }} />);
    });
  }

  it("emits cta_click with cta anchor when an a.la-cta link is clicked", async () => {
    await render('<p><a class="la-cta" href="#lead-form">Get the free guide</a></p><p><a class="la-cta la-cta-outline" href="https://example.com/x">Yes, show me how</a></p>');
    const links = container.querySelectorAll<HTMLAnchorElement>("a.la-cta");
    await act(async () => {
      links[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      links[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    const events = ctaBodies(fetchMock);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ eventName: "cta_click", eventData: { cta: "anchor" } });
    expect(events[1]).toMatchObject({ eventName: "cta_click", eventData: { cta: "anchor" } });
  });

  it("does not emit for ordinary links", async () => {
    await render('<p><a href="https://example.com/about">About</a></p>');
    await act(async () => {
      container.querySelector("a")!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(ctaBodies(fetchMock)).toHaveLength(0);
  });

  it("sends the anchor event with keepalive so navigation does not cancel it", async () => {
    await render('<p><a class="la-cta" href="https://example.com/offer">Claim the offer</a></p>');
    await act(async () => {
      container.querySelector("a.la-cta")!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    const call = fetchMock.mock.calls.find((c) => String((c as unknown[])[1] && ((c as unknown[])[1] as { body?: string }).body).includes('"cta_click"'));
    expect((call as unknown[])[1]).toMatchObject({ keepalive: true });
  });
});
