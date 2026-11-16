# Zoe is one Next.js modular monolith over Postgres

Zoe ships as a single TypeScript Next.js (App Router) application: React Server Components for reads, Server Actions for writes, Drizzle ORM over Postgres for storage, Zod at every input edge. Domain logic sits in framework-free modules under `zoe/src/domain/`; the web layer only adapts. We chose one deployable because the scheduling domain is highly cohesive (every write must re-check the same Rules) and a small team moves faster without network seams; modules can be extracted later along the `domain/` seams if load demands it.

## Considered Options

- **SPA + separate REST/GraphQL API service** — two deployables, duplicated types, no benefit until a third-party API is needed (that API will be a route group in this app first).
- **Microservices per module (scheduling, requests, time)** — every swap or edit crosses all of them; distributed transactions for no gain.
