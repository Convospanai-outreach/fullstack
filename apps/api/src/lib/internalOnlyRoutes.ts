// Routes that only the web app's server may call (with a signed internal-auth header), never a browser session.
// The verification-token endpoints hand a verifiable token for any email address back to the caller, and
// send-verification mails an address of the caller's choosing, so a signed-in user must not reach them.
const INTERNAL_ONLY_PREFIXES = ["/email/send-verification", "/email/verification-token", "/email/verify-token"];

export function isInternalOnlyRoute(path: string) {
    return INTERNAL_ONLY_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + "/"));
}
