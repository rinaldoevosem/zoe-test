# 05: On-call list for the hospital: 48 hours, JSON and CSV

Type: AFK
Status: open
Blocked by: None (can start immediately)
Spec: [beta spec](../spec.md)

## What to build

Who's On Call API returns the next 48 hours with stable IDs, as JSON or CSV.

## Acceptance criteria

- [ ] /api/on-call?hours=48 lists every on-call Assignment overlapping the window
- [ ] format=csv returns a CSV with stable Staff Member and Shift IDs
