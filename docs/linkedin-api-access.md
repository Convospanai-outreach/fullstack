# LinkedIn API access (creator funnel)

CraftMyFunnel posts approved calendar posts to LinkedIn through LinkedIn's official APIs. It uses two LinkedIn developer apps, because LinkedIn only grants the Community Management API (company pages) to an app that has no other product.

| | Profile app | Pages app |
|---|---|---|
| Posts to | The member's own profile | Company pages the member administers |
| LinkedIn products | Share on LinkedIn, Sign In with LinkedIn using OpenID Connect (self-serve) | Community Management API (LinkedIn reviews the request) |
| Scopes requested | `openid profile w_member_social` | `w_organization_social rw_organization_admin` |
| Env (web, Render) | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | `LINKEDIN_PAGES_CLIENT_ID`, `LINKEDIN_PAGES_CLIENT_SECRET` |
| Switch | none | Superadmin > Flags > `linkedin_pages` (off by default) |

Both apps use the same redirect URL, set as `LINKEDIN_REDIRECT_URI` on the web service:

```
https://craftmyfunnel.live/api/integrations/linkedin/oauth/callback
```

The API VMs need no LinkedIn secret. Publishing and the daily token check use the saved member token only.

## Setting up the profile app

1. At https://www.linkedin.com/developers/apps, create an app and associate it with the CraftMyFunnel LinkedIn page.
2. On the Products tab, add **Share on LinkedIn** and **Sign In with LinkedIn using OpenID Connect**.
3. On the Auth tab, add the redirect URL above and copy the client ID and secret.
4. On Render (craftmyfunnel-web), set `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` and `LINKEDIN_REDIRECT_URI`, then redeploy.
5. In a workspace with the creator funnel on, go to Settings > Social accounts and click **Connect LinkedIn profile**.

## Sign in with LinkedIn (login method)

"Continue with LinkedIn" on the sign-in and signup pages needs a **third LinkedIn app, used for nothing else**. It must not be the profile app: LinkedIn invalidates a member's earlier access tokens for an app when that app asks the same member for a different scope, so signing in through the profile app would disconnect the member's saved posting connection. The buttons stay hidden until this app's keys are set.

1. At https://www.linkedin.com/developers/apps, create an app and associate it with the CraftMyFunnel LinkedIn page.
2. On the Products tab, add **Sign In with LinkedIn using OpenID Connect** only.
3. On the Auth tab, add two redirect URLs:

   ```
   https://craftmyfunnel.live/api/auth/callback/linkedin
   https://craftmyfunnel.live/api/profile/linkedin-login/callback
   ```

4. On Render (craftmyfunnel-web), set `LINKEDIN_LOGIN_CLIENT_ID` and `LINKEDIN_LOGIN_CLIENT_SECRET` and redeploy. `NEXTAUTH_URL` must be the public site URL. To switch sign-in with LinkedIn off again, remove the two variables and redeploy.

How it behaves:

- **A connected profile signs in.** A LinkedIn profile signs in to the account it was connected to, whatever email LinkedIn has for it.
- **Existing accounts connect first.** Someone who already has an account signs in the usual way, then chooses **Connect LinkedIn** under Settings > General. A LinkedIn profile is never attached to an existing account because the email matches.
- **New people get an account.** A LinkedIn profile with a verified email that no account uses creates a new account and team, like a Google signup. An invite link still joins the inviting team.
- **Refused:** a profile with no verified email, a suspended account, and an account whose email domain enforces SSO.
- **One profile per account.** Changing or removing the connected profile isn't in the app yet.
- **Scopes and data.** Sign-in and connecting both ask for `openid profile email`. No LinkedIn token is stored for sign-in. This is separate from **Connect LinkedIn profile** under Settings > Social accounts, which is for posting and uses the profile app.

## Setting up the pages app

1. Create a **second, new** app with no other products, associated with the same LinkedIn page.
2. On the Products tab, request **Community Management API**. LinkedIn reviews the request and starts approved apps on the Development tier.
3. Add the same redirect URL. Once the request is approved, set `LINKEDIN_PAGES_CLIENT_ID` and `LINKEDIN_PAGES_CLIENT_SECRET` on Render and redeploy.
4. Turn on `linkedin_pages` in Superadmin > Flags. The **Connect LinkedIn page** button then appears. While the switch is off, pages can't be connected, sent for approval or posted to.

The member signing in needs an Administrator or Content admin role on each page.

## What LinkedIn allows, and how CMf handles it

Checked against LinkedIn's docs on 2026-10-04.

- **Tokens last 60 days.** Only selected partners get refresh tokens, so people sign in again. The daily token check warns workspace admins a week before expiry and marks the account "needs reconnecting" afterwards.
- **API version.** The `/rest` APIs need a `LinkedIn-Version` header (YYYYMM). Each version is retired about a year after release. The value is set in `apps/api/src/modules/creator-funnel/linkedinApi.ts` and `apps/web/src/modules/creator-funnel/linkedinConnect.ts`; bump both yearly.
- **Images.** JPEG, PNG or GIF. A post holds one image, or 2 to 20 with MultiImage. Uploads are processed asynchronously, so a post with images goes out a minute or two after its scheduled time.
- **Text.** Post text is LinkedIn "little" text. CMf escapes reserved characters so they show as typed. `#word` stays a hashtag. Posts are held to 3000 characters.
- **Daily limits.** Share on LinkedIn allows 150 requests per member per day. The Community Management Development tier allows 100 per member and 500 per app per day. When LinkedIn refuses with a limit error, the post fails with a message to send it again later.
- **Not available.** LinkedIn has no open API for reading or sending messages, or for reading comments on member posts. LinkedIn posts appear in the content calendar; nothing from LinkedIn reaches the Action Inbox.

## Doc links

- OAuth: https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
- Open permissions: https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access
- Sign In with LinkedIn (OpenID Connect): https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
- Share on LinkedIn: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin
- Posts API: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
- Images API: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api
- MultiImage: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/multiimage-post-api
- little text format: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format
- Page roles: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-access-control-by-role
- Community Management overview: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview
