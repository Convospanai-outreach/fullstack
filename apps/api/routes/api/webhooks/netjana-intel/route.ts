// Alias for /webhooks/netjana-intel: Netjana's own implementation calls
// POST /api/webhooks/netjana-intel (with the /api prefix), while every other route in
// this repo is registered bare. Re-exporting the same handler here avoids depending on
// Netjana's side matching our exact path convention.
export { POST } from "@/modules/intel/webhooks/netjanaIntelWebhook";
