# 02: Rule engine with plain-language Violations

**What to build:** the `rules` module judging a schedule snapshot: required Tags, overlap, approved time off, min rest, max consecutive days, max shifts/week, Preferences. Hard vs Soft, each Violation with a readable reason.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Tests at the `evaluate`/`checkAssignment` interface for every Rule kind
- [ ] DST night measured on real instants
