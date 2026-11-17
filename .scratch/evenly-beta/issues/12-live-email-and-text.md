# 12: Turn on real email and text messages

Type: HITL
Status: ready-for-human
Blocked by: 11
Spec: [beta spec](../spec.md)

## What to build

Deliveries are recorded as skipped because no provider is configured. Owner creates Resend (email) and Twilio (text) accounts and a sending domain/number; then set `RESEND_API_KEY`, `EVENLY_EMAIL_FROM`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` on the host and send one test of each. Also move the daily job to an hourly schedule (needs a paid host plan).

## Acceptance criteria

- [ ] One real email and one real text received from the preview
- [ ] The Delivery log shows them as sent
- [ ] Daily job runs hourly
