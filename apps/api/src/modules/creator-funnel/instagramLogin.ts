import { IG_GRAPH_BASE_URL } from "./metaGraph";

// "Connect Instagram only": the Instagram API with Instagram Login. No Facebook Page is involved,
// so the account row has no parentExternalId and its token is an Instagram User token used on
// graph.instagram.com. Accounts connected through Facebook always have a parent Page. Permission
// names checked 2026-10-24:
// https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login
// https://developers.facebook.com/documentation/instagram-platform/webhooks/fields.md
// - comments: instagram_business_basic + instagram_business_manage_comments
// - messages: instagram_business_basic + instagram_business_manage_messages
// - private replies and public comment replies: instagram_business_manage_comments

export const IG_LOGIN_COMMENTS_SCOPE = "instagram_business_manage_comments";
export const IG_LOGIN_MESSAGES_SCOPE = "instagram_business_manage_messages";

// Strictly null: a query that didn't select parentExternalId (undefined) is never taken for one.
export function isInstagramLogin(account: { platform: string; parentExternalId?: string | null }) {
    return account.platform === "INSTAGRAM" && account.parentExternalId === null;
}

/** The Instagram host for these accounts, as an optional last argument of graphCall/graphPostJson (none = Facebook). */
export function graphBaseArg(account: { platform: string; parentExternalId?: string | null }): [string] | [] {
    return isInstagramLogin(account) ? [IG_GRAPH_BASE_URL] : [];
}
