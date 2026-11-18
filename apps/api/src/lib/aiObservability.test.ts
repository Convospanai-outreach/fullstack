import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const nodeRequire = createRequire(import.meta.url);
const posthogAiLoaded = () => Object.keys(nodeRequire.cache).some((p) => /node_modules[\\/]@posthog[\\/]ai[\\/]/.test(p));

describe("lib/aiObservability", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("does not load @posthog/ai at import, and not at all without a PostHog key", async () => {
    vi.stubEnv("POSTHOG_API_KEY", "");
    const mod = await import("./aiObservability");
    expect(posthogAiLoaded()).toBe(false);

    const client = mod.createOpenAIClient({ apiKey: "sk-test" });
    expect(typeof client.chat.completions.create).toBe("function");
    expect(posthogAiLoaded()).toBe(false);
  });

  it("loads the wrapped client on first use when a PostHog key is set", async () => {
    vi.stubEnv("POSTHOG_API_KEY", "phc_test_lazy_load_check");
    const mod = await import("./aiObservability");
    expect(posthogAiLoaded()).toBe(false);

    const client = mod.createOpenAIClient({ apiKey: "sk-test" });
    expect(typeof client.chat.completions.create).toBe("function");
    expect(posthogAiLoaded()).toBe(true);
  });
});
