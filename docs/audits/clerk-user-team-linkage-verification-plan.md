# Clerk User & Team Linkage Verification Plan

Date: 2026-06-29
Repository: `Convospanai-outreach/fullstack`
Latest Main SHA: `06d1ee84551bec623f31b69933a4d6f2b8bfc4fa`
PR #54 Status: **MERGED**

---

## 1. Context and Problem Statement

All backend API health indicators, Vercel deployments, and Railway services are currently **green** (healthy). However, before the system can be cleared for controlled beta:
* **Clerk authentication success is not enough** by itself. 
* Clerk acts as our identity provider (IDaaS). A user successfully signing into Clerk only proves their credentials exist in Clerk's directory.
* The application code relies on relational mapping inside the Supabase Database (`User` table with `clerkUserId` column mapping to a `TeamMember` row) to authorize workspace access.
* If database synchronization via webhook fails, or if team mapping is missing, an authenticated user will experience `500` errors, missing tenant routing, or blank dashboards.

---

## 2. Read-Only Verification Approach

We define a 100% read-only verification approach to test the linkage boundary without mutating production data or modifying environment settings.

### Verification Scenarios to Test
1. **Unauthenticated Boundaries**: Confirm a signed-out user cannot access protected pages (`/dashboard`, `/campaigns`, `/leads`) or proxy APIs (`/api/proxy/*`), resulting in expected redirects or `401 Unauthorized`.
2. **Identity Linkage**: Verify that a signed-in Clerk user successfully resolves to a matching database `User` row.
3. **Team Mapping**: Verify the `User` maps correctly to a `TeamMember` row representing tenant membership.
4. **Workspace Resolution**: Confirm that the active workspace resolves the `Team` object corresponding to the active team session.
5. **Invite Enforcement**: Verify that a Clerk user without an approved database invite is handled safely (invite requested/pending state, not allowed into dashboard).
6. **Graceful Deletion Fallback**: Confirm that a user deleted in Clerk is handled safely by the app (session terminated, no dangling database auth exceptions).

---

## 3. Manual Browser Test Steps

Perform the following verification steps on the canonical production domain:

1. **Clean Session**: Open an incognito browser window and navigate to the application login route (`/login`).
2. **Clerk Authenticated Session**:
   * Login using the following test credentials:
     * **Username**: `tester@craftmyfunnel.live`
     * **User ID**: `user_3FnvrhumdY8nKNjoLMd7Ac6Pld7`
     * **Password**: `1234`
3. **Protected Navigation**: Navigate directly to `/dashboard`.
4. **DevTools Network Analysis**:
   * Open DevTools and filter by `/api/proxy` and `/api/auth`.
   * Verify whether the browser requests to proxy-backed endpoints return `200 OK` with valid JSON data, or block with `401`/`403`.

---

## 4. Safe Database Read-Only Checks

If direct database read-only console access is authorized and approved by the owner, run these queries to check linkage:

```sql
-- 1. Verify Clerk user maps to DB User
SELECT id, email, "clerkUserId", role 
FROM "User" 
WHERE "clerkUserId" = 'user_3FnvrhumdY8nKNjoLMd7Ac6Pld7';

-- 2. Verify DB User links to TeamMember
SELECT id, "teamId", "userId", role 
FROM "TeamMember" 
WHERE "userId" = (
  SELECT id FROM "User" WHERE "clerkUserId" = 'user_3FnvrhumdY8nKNjoLMd7Ac6Pld7'
);

-- 3. Verify Team exists for the resolved Member mapping
SELECT id, name, slug 
FROM "Team" 
WHERE id = (
  SELECT "teamId" 
  FROM "TeamMember" 
  WHERE "userId" = (
    SELECT id FROM "User" WHERE "clerkUserId" = 'user_3FnvrhumdY8nKNjoLMd7Ac6Pld7'
  )
);
```

---

## 5. Pass and Fail Criteria

### PASS Criteria
* Signed-out traffic is blocked with a redirect to `/login` or returns `401`.
* Signed-in tester session loads the `/dashboard` shell cleanly with no application crashes or database execution errors.
* The test user successfully resolves their `User` and `TeamMember` mappings, and proxy calls return valid payloads.
* Uninvited users are redirected to a pending approval screen.

### FAIL Criteria
* The signed-in session crashes the dashboard with a server error (`500`) or database connection crash.
* DevTools logs show missing local profile mapping (`User` row missing or `clerkUserId` null).
* The user resolves their session but cannot load team data due to a missing `TeamMember` mapping.
* Unauthenticated traffic can access `/dashboard` or proxied endpoints without a redirect.

---

## 6. Remaining Blockers

The product remains **NOT_READY** for production release. The following milestones must be resolved:

1. **Supabase Schema/Migration Proof**: Execution of the read-only migration status and diff checks is still pending.
2. **Redis/Cache Isolation**: Production namespace isolation verification.
3. **PR #6 (Gmail business mail)**: Remains open and blocked.
4. **Stage 12A Security Gate**: Minimum security audit is not started.
