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

## Comments
- Review follow-up: `format=csv` (bulk phone numbers) is limited to schedulers and admins. Phone numbers like `+1 555 0100` are no longer mangled by the spreadsheet-formula guard.
- Not done: a paging system can't call the endpoint yet, because it needs a signed-in session. Integration tokens per Department belong with production auth (v1 ticket 14).
