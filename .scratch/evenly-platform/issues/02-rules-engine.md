# 02: Rule engine with plain-language Violations

**What to build:** the `rules` module judging a schedule snapshot: required Tags, overlap, approved time off, min rest, max consecutive days, max shifts/week, Preferences. Hard vs Soft, each Violation with a readable reason.

**Blocked by:** None (can start immediately)

**Status:** done (v0 prototype, shipped)

- [x] Tests at the `evaluate`/`checkAssignment` interface for every Rule kind
- [x] DST night measured on real instants
