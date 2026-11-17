import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const nodeRequire = createRequire(import.meta.url);
const stripeLoaded = () => Object.keys(nodeRequire.cache).some((p) => /node_modules[\\/]stripe[\\/]/.test(p));

describe("lib/stripe", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is null and not configured without a secret key", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const mod = await import("./stripe");
    expect(mod.stripe).toBeNull();
    expect(mod.isStripeConfigured).toBe(false);
  });

  it("does not load the Stripe SDK until the client is first used, then works as before", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_lazy_load_check");
    const mod = await import("./stripe");
    expect(mod.isStripeConfigured).toBe(true);
    expect(stripeLoaded()).toBe(false);

    expect(typeof mod.stripe!.checkout.sessions.create).toBe("function");
    expect(stripeLoaded()).toBe(true);
    expect(mod.stripe!.webhooks).toBe(mod.stripe!.webhooks);
  });
});
