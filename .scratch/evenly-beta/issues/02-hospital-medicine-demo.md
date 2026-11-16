# 02: Hospital medicine demo Department

Type: AFK
Status: done
Blocked by: 01
Spec: [beta spec](../spec.md)

## What to build

Replace the demo seed with a hospital medicine Department: hospitalists, nocturnists and APPs; Day Team, Admitter, Nocturnist, APP Day and Procedure Shift Types; Continuity and Rest after Block on; one Certification expiring soon and one expired.

## Acceptance criteria

- [x] A fresh database seeds the hospital medicine Department and the e2e smoke passes
- [x] The seeded current period shows Blocks on Day Teams

## Comments

- Seeded staffing: 13 hospitalists (3 with the procedures Certification), 5 nocturnists, 5 APPs. Rules: max 7 days in a row (Hard), 7 days off after a 7-day Block (Hard), weekly limit off, Continuity on. The two seeded months fill with no Coverage Gaps and no Violations.
- Follow-up: the fairness summary compares everyone in one pool, so nocturnists, hospitalists and APPs read as "not equitable" against each other. Fairness should be compared within comparable groups (by Clinical Role or Shift Type pool). Not built yet.
- The seed takes a specialty; the anesthesiology data stays for the existing service tests.
