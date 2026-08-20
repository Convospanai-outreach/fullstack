import Stripe from "stripe";

const secretKey = process.env["STRIPE_SECRET_KEY"];

export const stripe = secretKey ? new Stripe(secretKey) : null;

export const isStripeConfigured = Boolean(secretKey);
