// Paths the site hands to the app. Forms and discovery files are served by the app. The email links
// keep working for messages sent while the public domain pointed at the app.
export const appRewriteSources = [
    '/api/invite-requests', '/api/contact', '/api/careers/apply',
    '/api/help/search', '/api/help/assistant', '/api/support/contact',
    '/api/errors/client', '/api/proxy/errors/client', '/api/site-banner', '/api/proxy/billing/plans',
    '/api/openapi.json', '/.well-known/api-catalog', '/.well-known/agent-card.json',
    '/.well-known/agent-skills/index.json', '/.well-known/agent-skills/:skill/SKILL.md',
    '/.well-known/http-message-signatures-directory', '/.well-known/microsoft-identity-association.json',
    '/api/track/open/:trackingId', '/api/track/click/:trackingKey', '/api/email/unsubscribe/:trackingId',
];
