// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PageTrackingPanel from "./PageTrackingPanel";

describe("PageTrackingPanel Meta Pixel fields", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function input(id: string): HTMLInputElement {
    const el = container.querySelector<HTMLInputElement>(`#tracking-${id}`);
    if (!el) throw new Error(`no field ${id}`);
    return el;
  }

  async function type(el: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  it("shows a Meta Pixel ID and a test event code next to the other IDs", async () => {
    await act(async () => root.render(<PageTrackingPanel initial={{ metaPixelId: "123456789012345", metaTestEventCode: "TEST1" }} onSave={vi.fn()} />));
    expect(input("metaPixelId").value).toBe("123456789012345");
    expect(input("metaTestEventCode").value).toBe("TEST1");
    expect(container.textContent).toContain("Meta Pixel ID");
  });

  it("refuses to save a Pixel ID that is not digits only", async () => {
    const onSave = vi.fn(async () => "saved");
    await act(async () => root.render(<PageTrackingPanel initial={null} onSave={onSave} />));
    await type(input("metaPixelId"), "12ab");
    const submit = container.querySelector<HTMLButtonElement>("button[type=submit]")!;
    expect(submit.disabled).toBe(true);
    expect(container.textContent).toContain("Expected a value like 123456789012345");
  });

  it("takes the server-side Meta token write-only: empty input, a saved state, and no token shown", async () => {
    const onSaveMetaToken = vi.fn(async () => "saved");
    await act(async () => root.render(<PageTrackingPanel initial={null} onSave={vi.fn()} metaTokenSaved onSaveMetaToken={onSaveMetaToken} />));
    const tokenField = container.querySelector<HTMLInputElement>("#meta-capi-token")!;
    expect(tokenField.type).toBe("password");
    expect(tokenField.value).toBe("");
    expect(container.textContent).toContain("Access token saved");
    expect(container.textContent).toContain("never shown again");

    await type(tokenField, "EAAB-long-test-access-token-value");
    const save = container.querySelector<HTMLButtonElement>("#meta-capi-token-save")!;
    await act(async () => save.click());
    expect(onSaveMetaToken).toHaveBeenCalledWith("EAAB-long-test-access-token-value");
    expect(container.querySelector<HTMLInputElement>("#meta-capi-token")!.value).toBe("");
  });

  it("sends the Meta fields with the other IDs when saved", async () => {
    const onSave = vi.fn(async () => "saved");
    await act(async () => root.render(<PageTrackingPanel initial={null} onSave={onSave} />));
    await type(input("metaPixelId"), "123456789012345");
    await type(input("metaTestEventCode"), "TEST12345");
    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ metaPixelId: "123456789012345", metaTestEventCode: "TEST12345", ga4Id: "" })
    );
  });
});
