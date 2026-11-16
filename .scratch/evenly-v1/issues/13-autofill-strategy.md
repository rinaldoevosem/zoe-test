# 13: Auto-fill strategy for v1

Type: grilling
Status: open
Blocked by: 09, 10, 11, 22
Map: [Evenly v1 map](../map.md)

## Question

Keep the deterministic greedy fill, add a solver adapter behind the same interface, or both (greedy for edits, solver for full builds)? Must keep: never move Locked Assignments, fill only gaps on request, explain every pick.

## Answer

Owner's answers in the stakeholder questionnaire, 2026-11-16 (https://claude.ai/artifact/1se9TniXGgXXBxQGK8yCMb):

- Product answer: **both** — by default Evenly drafts and a scheduler approves and publishes; a Department may switch on **Auto-publish** so a clean Auto-fill run publishes itself.
- Hospital medicine needs **blocks**: Auto-fill keeps one person on a Shift Type for consecutive days (Continuity) and respects rest after a block (ADR-0009).
- Still open: greedy vs solver adapter, pending the benchmark (ticket 22).
