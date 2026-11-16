# 03: Certifications: Tags with expiry dates

Type: AFK
Status: done
Blocked by: None (can start immediately)
Spec: [beta spec](../spec.md)

## What to build

Per-Tag expiry dates on Staff Members (schema, domain, Rule engine, Staff editor), with an 'expiring soon' list for admins.

## Acceptance criteria

- [x] An expired Tag fails requiredTags on Shifts after the expiry date with a message naming the date
- [x] The Staff editor sets and clears expiry dates; saving re-judges published Shifts
