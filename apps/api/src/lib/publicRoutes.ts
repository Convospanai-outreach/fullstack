// Routes the outer session gate in server.ts lets through without a NextAuth cookie or a signed
// internal header. Each entry covers itself and everything below it, by whole path segment, so a
// new route that only shares leading letters (say "/checkout/sessions") is not public by accident.
const PUBLIC_ROUTE_PREFIXES = [
    "/webhooks",
    // Alias of /webhooks/netjana-intel: Netjana's own implementation calls the
    // /api-prefixed path, which the "/webhooks" prefix match above doesn't cover.
    // The webhook's own authorizeApiKey() check is the real auth boundary here.
    "/api/webhooks/netjana-intel",
    "/auth",
    "/health",
    "/metrics",
    // "/test-auth" removed for production security
    "/scheduler",
    "/integrations/google/oauth/callback",
    "/integrations/google/pubsub",
    // Funnel visitors have no CraftMyFunnel session; the seller is resolved
    // from the (public, active-only) Product, not from the caller - see
    // checkout/api/session.ts. The Stripe Connect OAuth callback is a plain
    // redirect from stripe.com carrying no session either; its state token
    // (see gateways/oauthState.ts) is the actual security boundary, same
    // pattern as the Google OAuth callback above.
    "/checkout/session",
    "/checkout/accounts/stripe/callback",
    // Product display info (name/price) for the public checkout page -
    // active-only lookup, no team data leaked, see publicProduct.ts.
    "/checkout/public-products",
    // Plan pricing for the public /pricing marketing page - visitors see
    // real prices before signing up, no team-specific data returned.
    "/billing/plans",
    // Chrome extension routes enforce their own Bearer sync-token check
    // (validateExtensionAuth) - the extension has no
    // NextAuth cookie or Clerk-signed internal header to pass this gate.
    "/extension",
    // Published landing-page visitors have no CraftMyFunnel session, same
    // as checkout/session above - the page, lead capture, and event
    // tracking are all resolved by public slug (see
    // landing-agent/api/handlers.ts's getPublicPage/postPublicLead/
    // postPublicEvent), never by caller identity.
    "/landing-agent/public",
    // A physical edge node (Raspberry Pi/Jetson) has no NextAuth cookie or
    // Clerk-signed internal header either - PUT /edge/nodes (heartbeat) and
    // POST /edge/attest authenticate the node itself via an RSA signature
    // or a previously-issued session token (verifyEdgeRequestSignature/
    // verifyEdgeSessionToken in edgeRuntime.ts), not caller identity. The
    // admin-driven GET/POST/PATCH methods on /edge/nodes still enforce
    // their own getCurrentContext()+checkTeamPermission check inside the
    // handler (requireAdminContext in routes/edge/nodes/route.ts), same as
    // /extension above - this only skips the redundant outer gate.
    "/edge",
];

export function isPublicRoutePath(path: string) {
    return PUBLIC_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + "/"));
}
