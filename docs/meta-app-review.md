# Meta App Review: creator funnel permissions

This is what to submit to Meta App Review for the creator funnel. It covers connecting Instagram professional accounts and Facebook Pages, publishing posts, and reading and answering DMs and comments. The Lead Ads permissions (`leads_retrieval` and friends) are a separate, existing submission and are not covered here.

Permission names and dependencies were checked on 2026-09-30 against:

- https://developers.facebook.com/docs/permissions
- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/get-started.md
- https://developers.facebook.com/documentation/instagram-platform/content-publishing.md
- https://developers.facebook.com/documentation/instagram-platform/comment-moderation.md
- https://developers.facebook.com/docs/messenger-platform/instagram/get-started

Recheck them right before submitting. Meta renames and splits permissions between API versions.

## Before you submit

1. **Business Verification** for the Meta Business that owns the app. Advanced Access to most of the permissions below requires it.
2. **App settings**
   - Privacy policy URL, terms URL, app icon, and a data deletion instructions URL.
   - Category: Business.
3. **Valid OAuth redirect URI:** the value of `FACEBOOK_LEADS_REDIRECT_URI` (production: `https://craftmyfunnel.live/api/integrations/facebook/oauth/callback`). Both Lead Ads and the creator funnel use this redirect.
4. **Server environment**
   - apps/web needs `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET`; they already exist for Lead Ads.
   - apps/api (both Oracle VMs) needs the same two values, for the daily token health check. `FACEBOOK_APP_SECRET` also verifies every DM webhook delivery.
   - apps/api also needs `META_WEBHOOK_VERIFY_TOKEN`: any long random string, entered again in the App Dashboard (step 6).
5. **Webhooks (for DMs and comments)**
   - In the App Dashboard, under Webhooks, add a subscription for the **Page** object and one for the **Instagram** object. Both use the callback URL `https://api.craftmyfunnel.live/webhooks/meta-social` and the `META_WEBHOOK_VERIFY_TOKEN` value. Subscribe the Page object to `messages` and `feed`, and the Instagram object to `messages` and `comments`.
   - Instagram comment webhooks need **Advanced Access**, and the Instagram account must be public: "Advanced Access is required to receive `comments` ... webhook notifications" and "The Instagram professional account that owns the media objects must be public." (https://developers.facebook.com/docs/instagram-platform/webhooks/, checked 2026-10-01)
   - The Page `feed` field needs `pages_manage_metadata` and a person with the MODERATE task on the Page (https://developers.facebook.com/docs/graph-api/webhooks/reference/page/, checked 2026-10-01).
   - The app must be published (Live mode) to receive webhooks: "Your app must be published, regardless of app review status, to receive webhooks." (https://developers.facebook.com/docs/messenger-platform/instagram/features/webhook, checked 2026-10-01)
   - Connecting a Page in CraftMyFunnel subscribes it with `POST /{page-id}/subscribed_apps?subscribed_fields=messages,feed`. If that fails, the account shows the error under Settings > Social and Reconnect retries it. Pages connected before this change need a Reconnect to add `feed`.
6. **Test setup**
   - An Instagram professional account (Business or Creator) linked to a Facebook Page.
   - That Page managed by a Facebook user who has a role on the app (admin, developer or tester). Until approval, only app-role users can connect.
   - On that Instagram account, turn on **Settings > Messages and story replies > Message controls > Connected tools > Allow access to messages**. Without it, DMs won't arrive.

## Permissions requested

The "Connect Instagram and Facebook" button (Settings > Social accounts, with the creator funnel on) requests these permissions.

| Permission | What CraftMyFunnel uses it for | Built in |
|---|---|---|
| `pages_show_list` | List the Pages the user manages so they can pick which to connect. | Phase 2 |
| `pages_read_engagement` | Read the connected Page's own posts and metadata; a dependency of the Instagram permissions below. | Phase 2 |
| `pages_read_user_content` | Read comments people leave on the Page's posts, so keyword triggers can reply. | Phase 4 |
| `pages_manage_metadata` | Subscribe the Page to webhooks (Messenger and Instagram DMs, comments). | Phase 4 |
| `pages_manage_posts` | Publish posts the user scheduled and approved in the content calendar to their Page. | Phase 3b |
| `pages_manage_engagement` | Post a public reply to a Page comment when a keyword trigger the user set up asks for one. | Phase 4 |
| `pages_messaging` | Receive and reply to Messenger conversations with people who messaged the Page, from the CraftMyFunnel inbox. | Phase 4 |
| `instagram_basic` | Read the linked Instagram account's username and media. | Phase 2 |
| `instagram_content_publish` | Publish approved, scheduled posts to the Instagram account. | Phase 3b |
| `instagram_manage_comments` | Read comments on the account's posts, and reply publicly or privately when a keyword trigger matches. | Phase 4 |
| `instagram_manage_messages` | Receive Instagram DMs in the CraftMyFunnel inbox and reply to them. | Phase 4 |

**Not requested:** `ads_management` and `ads_read`. Meta's publishing and comment docs say these are also needed when the user's Page role comes only through Business Manager. For now, users should connect with a person who has a direct role on the Page. Add these two only if reviewers or users hit that case.

Submit each permission only once the feature that uses it is live. Reviewers reject permissions they can't see in use. Phase 2 can go in with `pages_show_list`, `pages_read_engagement` and `instagram_basic`; submit the rest with Phases 3b and 4.

## Screencast script (one per permission group)

Record at 1080p with the UI in English. Show the full Facebook sign-in, including the permission screen.

### Connect (pages_show_list, pages_read_engagement, instagram_basic)
1. Sign in to CraftMyFunnel as a workspace admin.
2. Settings > Features: turn on **Creator funnel**.
3. Settings > Social accounts: click **Connect Instagram and Facebook**.
4. In the Facebook dialog, choose the test Page (and its Instagram account) and accept the permissions.
5. Back in CraftMyFunnel, show the Page and `@instagram-handle` listed as Connected.
6. Click **Disconnect** on one, and show that it disappears.

### Publishing (pages_manage_posts, instagram_content_publish), after Phase 3b
1. Content > Calendar: create a post with an image, pick the Page and the Instagram account, and write captions.
2. Send it for approval, approve it, and schedule it a few minutes ahead.
3. Show the post appearing on the Facebook Page and the Instagram profile, and the calendar card turning Published.

### Messages (pages_messaging, instagram_manage_messages, pages_manage_metadata), after Phase 4
1. From a second (tester) account, send a DM to the Instagram account and a message to the Page.
2. Show both arriving in CraftMyFunnel's Inbox, then reply from the Inbox.
3. Show the replies arriving on the tester's phone or browser.

Showing the sender's name for Facebook Page messages also needs the **Business Asset User Profile Access** feature (https://developers.facebook.com/docs/messenger-platform/identity/user-profile, checked 2026-10-01). Without it, Page conversations appear as "Facebook contact"; everything else works.

### Comments (instagram_manage_comments, pages_read_user_content, pages_manage_engagement), after Phase 4
1. Settings > Social > Keyword auto-replies: create one for the keyword "GUIDE" (a DM with a landing page link, plus a public reply), and switch it on.
2. From the tester account, comment "GUIDE" on the post.
3. Show the private reply (DM) arriving, and the optional public reply under the comment.

## Test user instructions for reviewers

Give reviewers:

- A CraftMyFunnel login for a workspace with the creator funnel already on.
- A Facebook test user (or a real account added as an app tester) who manages the test Page, with the linked Instagram professional account.
- A second tester account to send DMs and comments.
- The steps above, in order.

## Operational notes

- **Token lifetime.** Facebook Page accounts use the Page token, which doesn't expire when obtained through a long-lived user token. Instagram accounts use the long-lived User token, because Instagram's publishing endpoints list "Access Tokens | User"; it lasts about 60 days and Meta doesn't let a server refresh it, so people reconnect about every two months (they're warned a week before). A daily check (`checkSocialTokens`) still asks Meta, and moves an account to "Needs reconnecting" if Meta invalidates it (password change, permissions removed, app removed). Admins get an in-app and email notice, and one warning if a token reports an expiry within a week.
- **Graph API version.** Social calls use v26.0. The older Lead Ads code uses v21.0, which Meta supports until 2027-01-21; move it before then.
- **Publishing limit.** Meta's docs disagree on the number (the publishing guide says 100 API-published posts per 24 hours; the `media_publish` and `content_publishing_limit` references say 50), so the publisher reads `quota_usage` and `config.quota_total` from `GET /<IG_ID>/content_publishing_limit` before each Instagram post instead of hard-coding either.
- **Media hosting.** Instagram fetches media from a public URL at publish time, so post media is served from the creator-funnel storage bucket.
- **Keyword auto-replies.** Each comment gets at most one private reply (Meta allows one, within 7 days), and each person at most one auto-reply per trigger per day. Each account is capped at 200 auto-replies an hour; Instagram allows "750 calls per hour per Instagram professional account for private replies to comments on Instagram posts and reels" (https://developers.facebook.com/docs/instagram-platform/overview/, checked 2026-10-01). Auto-replies only send after someone switches them on.
- **DM reply window.** Meta allows replies for 24 hours after the person's last message (https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy, checked 2026-10-01). The inbox enforces it and doesn't use message tags; the `HUMAN_AGENT` tag would need its own permission. Instagram replies are limited to 1,000 bytes.
