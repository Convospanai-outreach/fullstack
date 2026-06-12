# Supabase Postgres Setup

CraftMyFunnel can use Supabase only as the hosted PostgreSQL database.

Do not migrate this app to Supabase Auth. Clerk remains the signup, OAuth, and session authority. Postgres stores synced app users, workspaces, memberships, CRM data, and billing data. Do not add `@supabase/supabase-js` for client-side database access unless that is requested separately. Prisma remains the ORM and the main database access layer.

## Environment Variables

Set the database connection strings in the deployment environment for each app that uses Prisma:

```env
DATABASE_URL=
DIRECT_URL=
```

Use Supabase pooled connection strings for `DATABASE_URL` when the deployment platform needs connection pooling. Use the direct Supabase Postgres connection for `DIRECT_URL` when Prisma migrations or direct schema operations expect an unpooled connection.

Keep `apps/web` and `apps/api` aligned if both services use their own Prisma client/schema.

## Local/Build Commands

```bash
npm install
npm run db:generate --workspace apps/web
npm run build:web
```

For the API app, keep the matching environment variables available and run:

```bash
npm run build:api
```

## Rules

- Supabase provides PostgreSQL hosting only.
- Prisma remains the database access layer.
- Clerk remains the authentication layer.
- Postgres stores application data after Clerk sync.
- No client-side Supabase database calls.
- No destructive migrations for this setup change.
