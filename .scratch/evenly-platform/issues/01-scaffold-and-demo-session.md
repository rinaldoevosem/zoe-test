# 01: Scaffold app, schema, seed and demo session

**What to build:** `evenly/` boots with `npm run dev`, creates an embedded Postgres, seeds a demo Organization/Department with staff, Shift Types and Rules, and lets a visitor "sign in as" any seeded User. App shell with sidebar (desktop) and bottom nav (mobile).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Zero-config start on PGlite; `DATABASE_URL` switches to Postgres
- [ ] Every table has organization_id
- [ ] Sign-in-as picker sets a long-lived session cookie
