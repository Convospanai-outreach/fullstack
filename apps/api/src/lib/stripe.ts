import { createRequire } from "node:module";
import type Stripe from "stripe";

const secretKey = process.env["STRIPE_SECRET_KEY"];

// The Stripe SDK is about 1 MB of source and several MiB of heap, and only billing and checkout use it. It loads on
// first use instead of at boot (the api container has a boot memory budget, see API_BOOT_MEM_BUDGET_MIB in ci.yml).
// `stripe` keeps its old shape, so callers still write stripe.checkout.sessions.create(...) synchronously.
const nodeRequire = createRequire(import.meta.url);
let client: Stripe | undefined;

function load(): Stripe {
  if (!client) {
    const StripeSdk = nodeRequire("stripe") as new (key: string) => Stripe;
    client = new StripeSdk(secretKey as string);
  }
  return client;
}

export const stripe: Stripe | null = secretKey
  ? (new Proxy({}, { get: (_target, prop) => Reflect.get(load(), prop) }) as Stripe)
  : null;

export const isStripeConfigured = Boolean(secretKey);
