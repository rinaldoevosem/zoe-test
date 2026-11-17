# 11: Permanent database for the beta

Type: HITL
Status: ready-for-human
Blocked by: None (can start immediately)
Spec: [beta spec](../spec.md)

## What to build

The preview runs on an in-memory database that resets whenever the host restarts it. The beta needs a hosted US Postgres (v1 decision: a US cloud we manage). Owner picks the provider (e.g. Neon, Supabase, AWS RDS) and creates the account; then set `DATABASE_URL` on the host and run migrations.

## Acceptance criteria

- [ ] Provider chosen and account created by the owner
- [ ] `DATABASE_URL` set on the host; data survives a restart
- [ ] Demo seeding disabled for the pilot's real Department
