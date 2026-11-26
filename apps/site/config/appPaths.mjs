// Pages the product app serves. The site redirects them to the app host so old links keep working.
const dashboardRoutes = [
    'accounts', 'admin', 'agents', 'analytics', 'approvals', 'audit-logs', 'automations', 'billing', 'calendar',
    'caller', 'campaigns', 'command-center', 'content', 'crm', 'crystal-knows', 'csv-ingestion', 'edge',
    'governance', 'hunter-email-finder', 'icp-builder', 'inbox', 'intel', 'jobs', 'knowledge', 'landing-agent',
    'leads', 'linkedin-runner', 'marketplace', 'monitoring', 'notifications', 'pipeline', 'playbooks', 'profile',
    'runtime', 'scraper-bridge', 'settings', 'sovereign', 'studio', 'team', 'templates', 'tools', 'whatsapp',
    'workflows',
];

export const appPaths = [
    '/login/:path*', '/signup', '/forgot-password', '/magic-link', '/verify-email',
    '/accept-invite', '/client-login', '/agent-login', '/complete-profile', '/onboarding',
    '/setup', '/dashboard/:path*', '/checkout/:path*', '/credits', '/extension/:path*',
    '/client/:path*', '/superadmin/:path*', '/p/:path*', '/mcp/connect', '/cms/:path*',
    ...dashboardRoutes.map(route => `/${route}/:path*`),
];
