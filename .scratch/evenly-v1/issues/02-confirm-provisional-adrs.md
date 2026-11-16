# 02: Confirm or overturn the provisional ADRs

Type: grilling
Status: open
Blocked by: None (can start immediately)
Map: [Evenly v1 map](../map.md)

## Question

ADR-0001…0008 were decided by the agent under delegated ownership, without a grilling session. Walk each one with the owner: keep, amend, or supersede. Highest-stakes: modular monolith on Next.js/Postgres (0001), shared-DB tenancy (0003), auto-approved trades (0005), PWA instead of native (0007).

## Answer

Owner's answers in the stakeholder questionnaire, 2026-11-16 (https://claude.ai/artifact/1se9TniXGgXXBxQGK8yCMb):

- ADR-0005 (rule-clean trades auto-approve, Department can switch to manual): **confirmed**.
- ADR-0007 (one responsive PWA): **amended** — PWA for the beta, native store apps required before general availability.
- Shift Types stay **admin-only**; "want" Preferences only break ties: **confirmed** (conflicts from v0 ticket 16).
- The other ADRs remain provisional.
