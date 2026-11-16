# CLAUDE.md

This repository contains two unrelated things:

- **`zoe/`** — Zoe, a clinical workforce scheduling platform (Next.js + TypeScript). This is where product work happens.
- Everything else at the root (`assets/`, `sections/`, `templates/`, …) — a legacy Shopify theme. Do not modify it as part of Zoe work.

## Working on Zoe

- Read `GLOSSARY.md` first and use its vocabulary in code, tests, tickets and commits.
- Architecture decisions live in `docs/adr/`. Surface any conflict with an ADR explicitly.
- Domain logic lives in deep, pure modules under `zoe/src/domain/` with tests at their interface. UI and persistence call into them; they never call out.
- Commands (run inside `zoe/`): `npm run dev`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run e2e`.
- The app runs with zero setup on an embedded Postgres (PGlite). Set `DATABASE_URL` to use a real Postgres.

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
