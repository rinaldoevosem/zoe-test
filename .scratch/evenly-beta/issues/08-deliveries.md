# 08: Email and text Deliveries with Quiet Hours

Type: AFK
Status: open
Blocked by: 07
Spec: [beta spec](../spec.md)

## What to build

Pure notification policy; per-person channel settings and Quiet Hours; a Delivery outbox with pluggable providers (recorded as skipped when none is configured).

## Acceptance criteria

- [ ] Urgent alerts go to in-app, email and text, even in Quiet Hours
- [ ] Non-urgent email in Quiet Hours is held until the window ends
- [ ] People can set email, mobile number and Quiet Hours on My schedule
