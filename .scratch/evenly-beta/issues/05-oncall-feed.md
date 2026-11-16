# 05: On-call list for the hospital: 48 hours, JSON and CSV

Type: AFK
Status: done
Blocked by: None (can start immediately)
Spec: [beta spec](../spec.md)

## What to build

Who's On Call API returns the next 48 hours with stable IDs, as JSON or CSV.

## Acceptance criteria

- [x] /api/on-call?hours=48 lists every on-call Assignment overlapping the window
- [x] format=csv returns a CSV with stable Staff Member and Shift IDs
