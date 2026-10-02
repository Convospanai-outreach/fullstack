// Where a user lands after signing in: Home, which leads with "Needs you" (what's waiting
// on the user, one click from acting). This replaced the NEXT_PUBLIC_ACTION_INBOX_ENABLED
// flag that sent users to /inbox; the inbox is one click away from Home and the sidebar.

export function postLoginPath() {
    return "/dashboard";
}
