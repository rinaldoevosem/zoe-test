# Zoe — clinical workforce scheduling

Zoe plans who works which clinical Shift, keeps the plan legal and fair, and lets staff trade, request and see their work from a phone. MIT licensed.

**Why it exists:** the incumbent tools work, but their users report the same problems again and again (see `../docs/research/0001-qgenda-landscape.md`). Zoe is designed against that list:

| Reported pain | Zoe's answer |
| --- | --- |
| Auto-scheduler: fixing one conflict creates another | Auto-fill fills only Coverage Gaps, never moves Locked Assignments, is deterministic, and explains every pick, including the runners-up (ADR-0002) |
| Trades stuck waiting for an admin | One Rule engine checks every trade before it is sent. Rule-clean trades are approved automatically (ADR-0005) |
| Calendar sync hours out of date | The Calendar Feed is rendered from the published schedule on every request (ADR-0006) |
| Mobile app logs you out and lacks web features | One responsive PWA with a 30-day sliding session, so mobile has the same features by construction (ADR-0007) |
| Click-heavy admin, opaque rules | Click a cell and get eligible staff ranked by Load. Every Violation is plain language. Hard Rules block, Soft Rules warn |
| Weak fairness reporting | Load (weighted Shifts ÷ FTE) report, spread KPI and CSV exports |

## Run it

```bash
npm install
npm run dev          # http://localhost:3000. Embedded Postgres (PGlite) is seeded on first start.
```

Sign in as anyone from the picker:

- **Pat Rivera** is a scheduler.
- **Dr. Morgan Lee** is an admin who also works Shifts.
- Everyone else is a member of staff.

| Variable | Effect |
| --- | --- |
| `DATABASE_URL` | Use a real Postgres instead of PGlite (migrations run on start) |
| `ZOE_DB=memory` | Throwaway in-memory database |
| `ZOE_NOW=2026-11-16T15:00:00Z` | Pin the clock (demos, e2e) |
| `ZOE_SESSION_SECRET` | Cookie signing secret. **Set it in production.** |

## Develop

```bash
npm test             # Vitest: domain modules + services on PGlite
npm run typecheck
npm run lint
npm run e2e          # Playwright smoke; PW_CHROMIUM=/path/to/chrome to use a preinstalled browser
npm run db:generate  # after editing src/server/db/schema.ts
```

## Architecture

**Stack:**

- Next.js 16 (App Router, Server Actions, Cache Components)
- React 19
- TypeScript (strict)
- Tailwind CSS v4 with vendored **shadcn/ui** (MIT)
- Drizzle ORM over Postgres/PGlite
- Zod
- Vitest and Playwright

```
src/domain/     pure, framework-free deep modules — the test seams
  rules.ts        evaluate / checkAssignment / checkCandidate → Violation[]  (the single judge)
  autofill.ts     deterministic, explainable gap filling
  load.ts         fairness (Load = Σ weight ÷ FTE)
  trades.ts       Swap / Giveaway / Pickup state machine with auto-approval
  timeoff.ts      Request Limit, conflicts
  time.ts         local date + minutes ↔ instants (DST-safe, ADR-0004)
  ical.ts         RFC 5545 rendering
  permissions.ts  can(user, action)
src/server/     adapters: db schema, repo snapshots, services, session seam
src/app/        pages (RSC), Server Actions, API routes (ICS, on-call JSON, CSV, health)
src/components/ UI; components/ui is vendored shadcn/ui
```

Vocabulary is in `../GLOSSARY.md`, decisions are in `../docs/adr/`, and the spec and tickets are in `../.scratch/zoe-platform/`.

The workflow uses the vendored skills in `../.claude/skills` (mattpocock/skills, MIT). See `../.claude/skills/README.md`.
