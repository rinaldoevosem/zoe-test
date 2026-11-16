# Evenly — Clinical Workforce Scheduling

Evenly plans who works which clinical shift, keeps that plan legal and fair, and lets staff trade, request and see their work from anywhere.

## Organization

**Organization**:
The customer tenant — a hospital, health system or physician group. Every record belongs to exactly one.
_Avoid_: Tenant (in UI copy), customer, account

**Department**:
A scheduling unit inside an Organization with its own Rules, Shift Types and time zone (e.g. Anesthesiology, Emergency Medicine).
_Avoid_: Group, team, service line

**Staff Member**:
A person who can be assigned to Shifts in a Department.
_Avoid_: Provider (only some are), employee, resource, user

**User**:
A login identity. A User may be linked to one Staff Member and holds one Permission Level.
_Avoid_: Account, login

**Permission Level**:
What a User may do: `staff` (own schedule and requests), `scheduler` (build and publish), `admin` (configure the Department).
_Avoid_: Role (reserved for clinical role)

**Clinical Role**:
A Staff Member's professional category (physician, CRNA, resident, nurse, APP). Drives eligibility, never permissions.

**Tag**:
A label on a Staff Member that a Shift Type can require — a skill, privilege or credential (e.g. `peds`, `cardiac`, `ACLS`).
_Avoid_: Skill, qualification

**FTE**:
The fraction of a full workload a Staff Member is contracted for (0.0–1.0). Fairness is measured relative to it.

## Schedule

**Shift Type**:
A reusable definition of work: name, local start/end time, required Tags, headcount, the weekdays it occurs, Weight, and whether it is On-Call.
_Avoid_: Task (legacy vendor term), template, slot

**Shift**:
One occurrence of a Shift Type on a specific date, needing `headcount` Assignments.
_Avoid_: Slot, block

**Assignment**:
A Staff Member placed on a Shift. May be **Locked** so Auto-fill never moves it.
_Avoid_: Booking

**Schedule Period**:
A contiguous date range that is built and Published as a unit. Status is `draft` or `published`.
_Avoid_: Roster, block schedule

**Publish**:
Making a Schedule Period's Assignments visible to staff and to calendars. Later changes to a published period notify the affected Staff Members.

**Coverage Gap**:
A Shift with fewer Assignments than its headcount.
_Avoid_: Hole, open slot

**On-Call**:
A Shift Type flag meaning its Assignees must be reachable; On-Call Shifts appear in the Who's On Call directory.

**Who's On Call**:
The read-only directory answering "who is on call for this Department right now (or at time T)".

## Rules & fairness

**Rule**:
A configurable constraint on Assignments. Each is either **Hard** (must never be broken; blocks the change) or **Soft** (may be broken; costs Penalty and shows a warning).
_Avoid_: Constraint (in UI copy), policy

**Violation**:
One instance of a Rule being broken by a particular Assignment, with a human-readable reason.
_Avoid_: Conflict, error

**Penalty**:
The numeric cost of Soft Rule Violations; Auto-fill minimises it.

**Auto-fill**:
Evenly filling Coverage Gaps in a Schedule Period without breaking Hard Rules, minimising Penalty, and never moving Locked Assignments.
_Avoid_: Auto-schedule, optimizer, generate

**Explanation**:
The reason Auto-fill chose a Staff Member for a Shift, and why the runners-up lost.

**Weight**:
How much one Shift of a Shift Type counts towards Load (e.g. a 24h call = 2.0, a half day = 0.5).

**Load**:
A Staff Member's sum of Assignment Weights in a range, divided by FTE. Fairness means equalising Load.
_Avoid_: Points, credits, burden

## Requests & trades

**Time-Off Request**:
A Staff Member's request not to be scheduled on a date range. `pending` → `approved` | `denied` | `cancelled`. Approved time off is a Hard Rule.
_Avoid_: Vacation request, PTO request

**Request Limit**:
The maximum number of Staff Members in a Department who may have approved time off on the same date.

**Preference**:
A Staff Member's wish about one date, optionally narrowed to one Shift Type: **avoid** (rather not work it; breaking it costs Penalty) or **want** (would like to work it; it only wins ties, never Load or Penalty).

**Swap**:
Two Staff Members exchanging their Assignments on two Shifts.
_Avoid_: Trade (in code), switch

**Giveaway**:
A Staff Member offering one of their Assignments to any eligible colleague.
_Avoid_: Drop, release

**Pickup**:
An eligible Staff Member claiming a Giveaway or a Coverage Gap.

**Trade Request**:
The umbrella record for a Swap or Giveaway as it moves `open` → `accepted` → `approved` | `rejected` | `withdrawn`. Rule-clean trades are approved automatically when the Department allows it.

## Records

**Audit Event**:
An immutable record of who changed what in a schedule, when, and why.
_Avoid_: Log entry, history

**Calendar Feed**:
A secret, revocable URL serving a Staff Member's published Assignments as iCalendar, always current.
_Avoid_: Sync, export

**Time Entry**:
An actual worked interval (clock-in/clock-out) that may be reconciled against an Assignment for payroll.
_Avoid_: Punch, timesheet row
