# Per-prospect tear-down runbook

A tear-down is an isolated, clearly fictional workspace built for one prospect's niche and buyers, shown by
screen-share or over MCP. It never contains real third-party data, and nothing in it can be sent.

Rules the builder enforces (see `apps/api/src/scripts/teardown/build.ts`): every row id carries the prospect slug;
every lead email ends in `.example` with no consent recorded; campaigns are `draft` or `paused` only; the team is
named `Tear-down: <Prospect>`.

**Specs name real prospects. Keep them out of this public repo**, for example in `D:\cmf-private\teardowns\`.
Only fictional examples live in `apps/api/src/scripts/teardown/specs/`.

## Steps

1. Copy `specs/example-cybersecurity.json` to the private folder and edit it. `credits` defaults to 100 if omitted;
   set `0` unless you want live `generate_message_preview` in the demo.
2. Dry run (writes nothing). Needs `DATABASE_URL` (and `NODE_EXTRA_CA_CERTS` for Supabase TLS) in the environment:
   `OWNER_EMAIL=<your account> npx tsx src/scripts/teardown.ts --spec <path>`
3. After an explicit go-ahead for that prospect, run again with `--apply`.
4. In Claude, run `/mcp`, re-authenticate, and pick the tear-down workspace at consent.
5. Walk through `list_icps`, `list_campaigns`, `get_lead_thread`, `get_pipeline_stats`.
6. Afterwards disconnect the MCP grant (100 active grants per user is the cap) and run the same command with
   `--remove --apply`. This deletes the workspace rows, keeps the Team row, and marks your membership inactive,
   which stops any MCP connection to that workspace.

`scripts/seed-mcp-demo.ts` is the built-in directory-review demo run through the same code.
