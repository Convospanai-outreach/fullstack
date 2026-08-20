require('dotenv').config();
const Stripe = require('stripe');

console.log("Checking STRIPE_SECRET_KEY...");
if (!process.env.STRIPE_SECRET_KEY) {
    console.log("STRIPE_SECRET_KEY is missing!");
} else {
    console.log("STRIPE_SECRET_KEY is present.");
}

try {
    console.log("Initializing Stripe...");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
        apiVersion: "2025-11-17.clover",
        typescript: true,
    });
    console.log("Stripe initialized successfully.");
} catch (e) {
    console.error("Stripe initialization failed:", e.message);
}
