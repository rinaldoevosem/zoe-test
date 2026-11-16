# 08: Email and text Deliveries with Quiet Hours

Type: AFK
Status: done
Blocked by: 07
Spec: [beta spec](../spec.md)

## What to build

Pure notification policy; per-person channel settings and Quiet Hours; a Delivery outbox with pluggable providers (recorded as skipped when none is configured).

## Acceptance criteria

- [x] Urgent alerts go to in-app, email and text, even in Quiet Hours
- [x] Non-urgent email in Quiet Hours is held until the window ends
- [x] People can set email, mobile number and Quiet Hours on My schedule

## Comments

- Providers: Resend (email: `RESEND_API_KEY`, `EVENLY_EMAIL_FROM`) and Twilio (text: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`). Their request code is exercised in tests against a stubbed `fetch`, not yet against the live services. Without keys every Delivery is recorded as skipped with the reason.
- Held Deliveries are sent by the next dispatch: whenever any Notification is sent, and by the daily job. On a host whose scheduler only allows a daily run (Vercel Hobby), an email held by Quiet Hours can wait until that run; an hourly schedule fixes this.
