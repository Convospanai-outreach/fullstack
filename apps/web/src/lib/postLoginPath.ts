// Where a user lands after signing in. NEXT_PUBLIC_ACTION_INBOX_ENABLED (default on) makes
// it the Action Inbox; set it to "false" to roll back to /dashboard. NEXT_PUBLIC_ because
// the login pages are client components, which means the value is inlined at build time:
// flipping it needs a rebuild/redeploy of apps/web.

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace NodeJS {
        interface ProcessEnv {
            // Declared so it can be read with dot access, the form Next.js documents as inlined.
            NEXT_PUBLIC_ACTION_INBOX_ENABLED?: string;
        }
    }
}

export function postLoginPath() {
    return process.env.NEXT_PUBLIC_ACTION_INBOX_ENABLED === "false" ? "/dashboard" : "/inbox";
}
