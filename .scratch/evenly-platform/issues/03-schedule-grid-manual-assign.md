# 03: Schedule grid with one-click assign and live Violations

**What to build:** scheduler creates a Schedule Period, sees dates × Shift Types grid with Coverage Gaps, opens a Shift to see eligible candidates ranked by Load with their Violations, assigns/unassigns/locks. Hard Violations block.

**Blocked by:** 01, 02

**Status:** done (v0 prototype, shipped)

- [x] Assign path calls rules before writing
- [x] Audit Event written for every change
