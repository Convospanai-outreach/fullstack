// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CopyHelperPanel from "@/components/landing-agent/CopyHelperPanel";
import { patternsFor } from "@/components/landing-agent/copyPatterns";

describe("CopyHelperPanel", () => {
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

  async function render(onUse: (text: string) => boolean) {
    await act(async () => {
      root.render(<CopyHelperPanel onUse={onUse} />);
    });
  }

  it("lists the ten patterns for the default goal", async () => {
    await render(() => true);
    expect(container.textContent).toContain("Pick a stronger headline/CTA");
    const buttons = [...container.querySelectorAll<HTMLButtonElement>("button[data-pattern]")];
    expect(buttons).toHaveLength(10);
    expect(buttons.map((b) => b.dataset["pattern"])).toEqual(patternsFor("get_leads").map((p) => p.text));
  });

  it("passes the clicked pattern to onUse and confirms when it was applied", async () => {
    const onUse = vi.fn(() => true);
    await render(onUse);
    await act(async () => {
      container.querySelector<HTMLButtonElement>("button[data-pattern]")!.click();
    });
    expect(onUse).toHaveBeenCalledWith(patternsFor("get_leads")[0]!.text);
    expect(container.textContent).toContain("Copied into the selected text block.");
  });

  it("asks for a text block to be selected when nothing could be applied", async () => {
    await render(() => false);
    await act(async () => {
      container.querySelector<HTMLButtonElement>("button[data-pattern]")!.click();
    });
    expect(container.textContent).toContain("Select a text block in the page first");
  });

  it("shows the honesty warnings for text the user types", async () => {
    await render(() => true);
    const textarea = container.querySelector("textarea")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      setter.call(textarea, "Only 3 left, act now. 100% guaranteed");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const warnings = container.querySelector("[data-warnings]")!;
    expect(warnings.textContent).toContain("Only N left");
    expect(warnings.textContent).toContain("Act now");
    expect(warnings.textContent).toContain("100%");
    expect(warnings.textContent).toContain("Guarantee");
  });

  it("shows the editor-only hint next to urgency patterns", async () => {
    await render(() => true);
    expect(container.textContent).toContain("Only use this if it is true.");
  });
});
