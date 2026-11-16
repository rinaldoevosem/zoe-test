# Spec: Evenly beta for the hospital medicine pilot

Label: ready-for-agent
Source: the owner's answers in the stakeholder questionnaire (2026-11-16), recorded on `.scratch/evenly-v1/`. Builds on the v0 prototype (`.scratch/evenly-platform/`).

## Problem Statement

The pilot is a hospital medicine Department going live in about three months. Hospitalists work Blocks (about 7 days on the same team, then about 7 off), need procedure certifications that expire, and need the hospital operator and paging to know who is on call. Today Evenly is tuned for anesthesiology: Auto-fill rotates people daily, Tags never expire, alerts only live in the in-app inbox, and every Auto-fill run waits for a scheduler to publish.

## Solution

Evenly learns Blocks (Continuity and Rest after Block, plus assigning a whole Block at once), Certifications with expiry dates and reminders, an optional Auto-publish for clean Auto-fill runs, Urgent alerts for uncovered on-call Shifts with email and text message Deliveries that respect Quiet Hours, a 48-hour on-call list for the hospital, and a spreadsheet import for staff. The demo switches to a hospital medicine Department so the pilot sees itself.

## User Stories

1. As a scheduler, I want Auto-fill to keep a hospitalist on the same Day Team for consecutive days, so that patients see one doctor through their stay.
2. As a scheduler, I want a Rule that requires days off after a Block, so that 7-on/7-off is enforced, not remembered.
3. As a scheduler, I want to choose whether Rest after Block is Hard or Soft, so that I can bend it in a crunch.
4. As a scheduler, I want Auto-fill's Explanation to say a pick continues a Block, so that I trust why someone got 7 days in a row.
5. As an admin, I want to switch Continuity on or off per Department, so that non-block teams keep pure Load balancing.
6. As a scheduler, I want to assign one person to a Shift Type for N consecutive days in one action, so that I can lay down Blocks by hand.
7. As a scheduler, I want a Block assignment to be refused as a whole when any day breaks a Hard Rule, and told which day, so that I never get half a Block.
8. As an admin, I want to give a Tag an expiry date on a Staff Member, so that a lapsed procedure certification stops qualifying them.
9. As a scheduler, I want an expired Certification to block Assignments that need it, with a message that names the expiry date, so that I know why.
10. As a Staff Member, I want a reminder 30 days before my Certification expires, so that I can renew in time.
11. As an admin, I want to see which Certifications expire soon, so that I can chase renewals.
12. As an admin, I want to switch on Auto-publish, so that a clean Auto-fill run publishes without waiting for me.
13. As a scheduler, I want Auto-publish to hold back when Auto-fill leaves Hard Violations, so that nothing broken is published.
14. As a scheduler, I want an Urgent alert when an on-call Shift in the next 24 hours has nobody, so that I fix it before it bites.
15. As a Staff Member, I want Notifications by email as well as in the app, so that I don't have to open Evenly to stay informed.
16. As a scheduler, I want Urgent alerts also by text message, so that I see them at once.
17. As a Staff Member, I want Quiet Hours, so that non-urgent emails and texts wait until morning.
18. As a Staff Member, I want to set my email and mobile number for Notifications, so that they reach me.
19. As an admin, I want every email and text recorded as a Delivery with its outcome, so that I can prove an alert went out.
20. As the hospital operator, I want a list of who is on call for the next 48 hours as JSON and CSV with stable IDs, so that paging can load it.
21. As the onboarding team, I want to import Staff Members from a spreadsheet (CSV), so that setting up a Department takes minutes.
22. As the onboarding team, I want import to report rows it skipped and why, so that I can fix the sheet.
23. As anyone viewing the demo, I want a hospital medicine Department with Day Teams, an Admitter, Nocturnists, APPs and a Procedure service, so that the pilot recognises its world.

## Implementation Decisions

- Rule engine (ADR-0002) gains **Rest after Block** (`{enabled, hard, minBlockDays, daysOff}`) and a **Continuity** switch in the Department's Rule configuration. Missing fields in stored settings take defaults (both off), so existing Departments behave as before.
- Auto-fill: with Continuity on, candidates holding the same Shift Type on an adjacent day rank first; gaps fill in date order (ADR-0009). Explanations mention continuing a Block.
- Staff Members gain per-Tag expiry dates. The Rule engine treats a Tag as held on a Shift's date only if it has no expiry or the expiry is on or after that date. The Staff editor edits expiry dates.
- Department settings gain `autoPublish`. The Auto-fill action publishes after filling when it is on and the period has no Hard Violations.
- A daily job (`/api/cron/daily`, protected by a shared secret, run by the host's scheduler) sends Certification reminders (30 days ahead, once per Tag and expiry) and Urgent coverage alerts (on-call Shifts in the next 24 hours below headcount), de-duplicated.
- Notification policy is a pure domain module: given urgency, a person's channel settings and Quiet Hours, and the time, it returns which channels to use now and which to hold. Email and text message go through a Delivery outbox; providers plug in behind one interface. Without a configured provider a Delivery is recorded as skipped, never faked.
- Who's On Call gains a 48-hour window and CSV output with stable Staff Member and Shift IDs.
- Staff import parses CSV (name, email, clinical role, FTE, Tags with optional expiry) in a pure module; the service upserts by email within the Department.
- The demo seed becomes a hospital medicine Department; anesthesiology fixtures stay in tests.

## Testing Decisions

- Test external behaviour at module interfaces: the Rule engine through `evaluate`/`checkAssignment`, Auto-fill through `autofill`, the notification policy and CSV parser as pure functions, services against an in-memory PGlite as in the existing service tests.
- Prior art: `rules.test.ts`, `autofill.test.ts`, `services.test.ts`, `followups.test.ts`; e2e smoke stays green.

## Out of Scope

Hospital single sign-on (needs the pilot's identity provider), native store apps (needed before GA, not for the beta), payroll export, Epic On-Call Finder, a production database host decision, census-driven staffing, nursing units, residents.

## Further Notes

Rule values for the pilot (block length, days off, rest hours) are provisional until the pilot's rule book arrives (v1 ticket 10).
