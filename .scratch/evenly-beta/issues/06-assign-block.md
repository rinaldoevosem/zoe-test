# 06: Assign a Block in one action

Type: AFK
Status: done
Blocked by: 01
Spec: [beta spec](../spec.md)

## What to build

Scheduler assigns one Staff Member to a Shift Type for N consecutive days from the assign panel; all-or-nothing on Hard Violations.

## Acceptance criteria

- [x] A clean Block creates N Assignments and one Audit Event
- [x] A Block with one Hard Violation creates nothing and names the day and Rule
