# 16: Follow-ups from the first two-axis code review

**What to build:** close the gaps the `code-review` skill reported on commit 2fbad9b that were not fixed in the same session.

**Blocked by:** 12

**Status:** done (commits 0e9a965 and the follow-up review fix)

- [x] Shift Type create/edit/deactivate (story 1, ticket 12 remainder) — today the table is read-only
- [x] Preferences: "want" wishes and Shift-Type-level Preferences (GLOSSARY: Preference); v0 supports date-level "avoid" only
- [x] Notify schedulers when a trade awaits approval under the manual policy (needs scheduler-addressable Notifications, not only Staff Members)
- [x] Saving Tags/FTE or Rule settings re-evaluates published periods and surfaces new Violations (ADR-0002)
- [x] Payroll CSV accepts a date range in the UI (the API already does)
- [x] Repository functions for the remaining direct queries in pages, so tenancy scoping lives in one place (ADR-0003)
- [x] Sign-in picker lists Users of one Organization only (demo adapter, ADR-0008)
- [x] Move fairness KPI thresholds (Load spread "Equitable") into `domain/load`

## Comments

**Implementation notes (agent):**

- **Shift Types.**
  - Times, headcount and weekdays apply to Schedule Periods created afterwards.
  - Name, colour, required Tags, Weight and On-Call are read live by existing Shifts, so every Shift Type save is re-judged against published schedules.
  - Shift Types are admin-only (`config:edit`), following this ticket and ticket 12. **Conflict to confirm:** spec story 1 says "as a scheduler".
- **Preferences.**
  - A Preference is a date, optionally narrowed to one Shift Type.
  - A "want" only wins ties; it never costs Penalty. GLOSSARY updated to match.
  - Standing Shift-Type wishes with no date (e.g. "never Night Call") are not built: an open product question.
- **Re-judging** reports only new **Hard** Violations, from today to 120 days ahead, and notifies schedulers.
  - Soft ones are left out to avoid noise.
  - FTE drives Load, not Rules, so an FTE change surfaces nothing here; it shows in the Load report.
- **Sign-in picker** shows one Organization at a time (`/signin?org=…`).
- **Known gap, deferred to production auth (ticket 13):** `getDepartment`/`loadSnapshot` look a Department up by id alone. Every caller passes the session's own departmentId, but Postgres RLS (ADR-0003) is the real backstop.
