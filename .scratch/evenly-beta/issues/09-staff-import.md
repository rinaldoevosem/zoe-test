# 09: Import Staff Members from a spreadsheet

Type: AFK
Status: done
Blocked by: 03
Spec: [beta spec](../spec.md)

## What to build

CSV import in Settings: parse in a pure module, upsert by email, report skipped rows.

## Acceptance criteria

- [x] A valid CSV creates and updates Staff Members including Tag expiry dates
- [x] Bad rows are reported with their line number and reason

## Comments
- Review follow-ups: absent columns and blank Role/FTE cells keep existing values on update. Expiry dates must be real dates. Only the sheet's emails are looked up for existing sign-ins.
- Deliberate addition: new people get a staff sign-in (User) so they can see their schedule; an email already used for a sign-in elsewhere gets no second one.
