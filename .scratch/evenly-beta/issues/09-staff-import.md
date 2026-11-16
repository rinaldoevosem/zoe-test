# 09: Import Staff Members from a spreadsheet

Type: AFK
Status: open
Blocked by: 03
Spec: [beta spec](../spec.md)

## What to build

CSV import in Settings: parse in a pure module, upsert by email, report skipped rows.

## Acceptance criteria

- [ ] A valid CSV creates and updates Staff Members including Tag expiry dates
- [ ] Bad rows are reported with their line number and reason
