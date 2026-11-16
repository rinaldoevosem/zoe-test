# Spec: Zoe platform v0 — clinical scheduling that schedulers trust and staff can use on a phone

Status: ready-for-agent

## Problem Statement

Clinical departments (anesthesia, emergency medicine, radiology, hospitalists, nursing units) build schedules under dozens of rules: credentials, rest periods, maximum shifts, fairness of nights/weekends/call, approved time off. Incumbent tools (see `docs/research/0001-qgenda-landscape.md`) cover this, but users report: an auto-scheduler that creates new conflicts as you fix old ones; trades stuck awaiting manual approval; calendar feeds hours stale; a mobile app that logs them out on every app switch and lacks web features; click-heavy admin screens; weak fairness reporting.

## Solution

One responsive web app (installable on phones) where:
- a **scheduler** defines Shift Types, Tags and Rules, runs **Auto-fill** that only fills Coverage Gaps, never moves Locked Assignments and **explains** every pick, edits any cell with live Violations, and **Publishes**;
- **staff** see their schedule, request time off, Swap/Giveaway/Pickup with an instant rule check and automatic approval when rule-clean, and subscribe a Calendar Feed that is always current;
- anyone can look up **Who's On Call**;
- schedulers get **Load fairness** and hours reports, payroll CSV, and an **Audit Event** trail of every change.

## User Stories

1. As a scheduler, I want to define Shift Types with local start/end times, weekdays, headcount, required Tags, Weight and an On-Call flag, so that Shifts are generated without manual entry.
2. As a scheduler, I want to create a Schedule Period for a date range, so that Shifts for every day are materialised from Shift Types.
3. As a scheduler, I want to see the period as a grid of dates × Shift Types with assignees and Coverage Gaps highlighted, so that I see coverage at a glance.
4. As a scheduler, I want to click a Shift and see eligible Staff Members ranked by Load with any Violations they would cause, so that I assign in one click.
5. As a scheduler, I want Hard Violations to block an assignment and Soft Violations to warn, so that I can't create an illegal schedule by accident.
6. As a scheduler, I want to Lock an Assignment, so that Auto-fill never moves it.
7. As a scheduler, I want Auto-fill to fill only Coverage Gaps, so that fixing one problem never reshuffles the rest.
8. As a scheduler, I want Auto-fill to be deterministic, so that re-running on the same input gives the same result.
9. As a scheduler, I want an Explanation for each Auto-fill pick, so that I can defend the schedule to colleagues.
10. As a scheduler, I want Auto-fill to report Shifts it could not fill and why, so that I know where to hire locums or negotiate.
11. As a scheduler, I want Rules for: required Tags, no double-booking/overlap, approved time off, minimum rest hours, max consecutive days, max shifts per week, and Preferences, so that common department policies are covered without custom development.
12. As a scheduler, I want each Rule to be Hard or Soft and to have a plain-language description, so that I understand what I'm configuring.
13. As a scheduler, I want Auto-fill to equalise Load relative to FTE, so that part-timers get proportionally fewer shifts.
14. As a scheduler, I want Weight per Shift Type, so that a 24h call counts more than a half day.
15. As a scheduler, I want to Publish a Schedule Period, so that staff and calendars see it.
16. As a staff member, I want to see only published Assignments, so that drafts don't confuse me.
17. As a staff member, I want "My Schedule" as an agenda on my phone with a jump-to-month control, so that I can find any month in one tap.
18. As a staff member, I want to request time off for a date range with a note, so that I'm not scheduled then.
19. As a staff member, I want to see immediately if my dates exceed the Request Limit, so that I can choose other dates.
20. As a scheduler, I want to approve or deny Time-Off Requests in a queue, so that requests don't get lost.
21. As a scheduler, I want approving time off to show which existing Assignments now Violate it, so that I can reassign.
22. As a staff member, I want to propose a Swap of my Assignment for a colleague's, and see before sending whether it is rule-clean, so that I don't waste anyone's time.
23. As a staff member, I want to accept or decline a Swap proposed to me, so that I control my schedule.
24. As a staff member, I want accepted rule-clean trades applied instantly, so that I don't wait days for an admin.
25. As a scheduler, I want to require manual approval of trades per Department, so that I can keep control where policy needs it.
26. As a staff member, I want to Give away an Assignment to any eligible colleague, so that I can get cover without messaging everyone.
27. As a staff member, I want to see Giveaways and Coverage Gaps I'm eligible to Pick up, so that I can earn extra shifts.
28. As anyone in the organization, I want a Who's On Call page for now or a chosen time, so that I can reach the right clinician.
29. As an integrator, I want Who's On Call as JSON, so that paging/EHR systems can consume it.
30. As a staff member, I want a Calendar Feed URL that I can subscribe to in Google/Outlook/Apple Calendar and that is always current, so that my personal calendar is right.
31. As a staff member, I want to regenerate my Calendar Feed URL, so that I can revoke a leaked link.
32. As a scheduler, I want a Load report per Staff Member for any range (shifts, hours, weekend shifts, On-Call shifts, Load), so that I can prove fairness.
33. As a scheduler, I want every report exportable as CSV, so that I can use it in payroll or spreadsheets.
34. As a staff member, I want to record Time Entries (clock in/out), so that worked time is captured.
35. As a payroll admin, I want a CSV of Time Entries reconciled against Assignments, so that payroll is accurate.
36. As a scheduler, I want an Audit Event for every Assignment, trade, request and publish, with actor and reason, so that disputes are settled quickly.
37. As a staff member, I want in-app Notifications when my published schedule changes or a trade needs me, so that I don't miss anything.
38. As a user on a phone, I want to stay signed in across app switches, so that checking my schedule takes one tap.
39. As an admin, I want to manage Staff Members (Clinical Role, FTE, Tags), so that eligibility is accurate.
40. As an evaluator, I want the app to run with zero setup and seeded demo data, so that I can try every flow in minutes.

## Implementation Decisions

- Architecture per ADR-0001: one Next.js app; framework-free domain modules; Server Actions for writes; RSC for reads.
- **Domain modules (deep, pure, the test seams):**
  - `rules` — interface: `evaluate(ctx) → Violation[]` and `checkAssignment(ctx, candidate) → Violation[]`. `ctx` is a plain snapshot: Shifts, Assignments, Staff Members, approved time off, Preferences, Rule config. All Rule kinds live behind this one interface (ADR-0002).
  - `autofill` — interface: `autofill(ctx) → { added: Assignment[], explanations, unfilled }`. Deterministic greedy: order Coverage Gaps by fewest eligible candidates, then date; choose candidate with no Hard Violation, lowest projected Load, then lowest Penalty, then stable id.
  - `load` — `computeLoad(ctx, range) → LoadRow[]`.
  - `trades` — state machine `transition(trade, event, ctx) → { trade, effects }` for Swap/Giveaway/Pickup with auto-approval when the post-trade schedule introduces no new Hard Violation and policy is `auto`.
  - `timeoff` — `checkRequestLimit` and request transitions.
  - `time` — local-date/minute ↔ instant conversion in a Department time zone (ADR-0004).
  - `ical` — `renderCalendar(events) → string` (RFC 5545, folded lines, escaped text).
  - `permissions` — `can(user, action)`.
- **Persistence**: Drizzle schema with `organization_id` on every table (ADR-0003). Tables: organizations, departments, users, staff_members, tags (as text[] on staff), shift_types, schedule_periods, shifts, assignments, time_off_requests, preferences, rules (JSON config per department), trade_requests, audit_events, notifications, calendar_tokens, time_entries.
- A repository layer loads a `ScheduleContext` snapshot for a Department + range and persists domain results; every write calls `rules` first.
- Session seam per ADR-0008 (demo cookie + sign-in-as picker).
- UI per ADR-0007: shadcn/ui components vendored; sidebar layout on desktop, bottom nav on mobile.

## Testing Decisions

- Good tests exercise a module through its interface with literal expected values (no recomputation), named in GLOSSARY terms.
- Seams under test: `rules`, `autofill`, `load`, `trades`, `timeoff`, `time`, `ical` (all in-process, Vitest). The persistence layer is tested via PGlite (local-substitutable) through the repository interface for the write paths that combine rules + storage (assign, trade apply).
- One Playwright smoke: sign in as scheduler → run Auto-fill → publish → sign in as staff → see My Schedule.

## Out of Scope (v0; ticketed for later)

Production SSO/auth adapter, Postgres RLS, email/SMS/push delivery, Epic/paging/payroll adapters, credentialing & privileging, room capacity, rotations/patterns & self-scheduling windows, float pool & census, per-person request quotas, multi-department enterprise directory, external solver adapter, i18n.

## Further Notes

Vocabulary follows `GLOSSARY.md`. Rationale for contested decisions is in `docs/adr/0001–0008`.
