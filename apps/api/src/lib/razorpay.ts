import Razorpay from "razorpay";

const keyId = process.env["RAZORPAY_KEY_ID"];
const keySecret = process.env["RAZORPAY_KEY_SECRET"];

export const razorpay = keyId && keySecret
    ? new Razorpay({ key_id: keyId, key_secret: keySecret })
    : null;

export const isRazorpayConfigured = Boolean(keyId && keySecret);
