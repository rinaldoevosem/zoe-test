# 15: Notification channels & urgency model

Type: grilling
Status: resolved
Blocked by: 01, 04
Map: [Evenly v1 map](../map.md)

## Question

Which channels in v1 (in-app, email, SMS, web push, native push)? What counts as urgent (uncovered on-call within 24h?) and who gets it? Quiet hours, digests, per-user tuning — the incumbent's duplicates/noise is a top complaint.

## Answer

Owner's answers in the stakeholder questionnaire, 2026-11-16 (https://claude.ai/artifact/1se9TniXGgXXBxQGK8yCMb):

- Channels: **in-app and email** for everything; **text message only when urgent**.
- Urgent = an on-call Shift with nobody covering it in the next 24 hours.
- Everyone can set **quiet hours**; urgent alerts ignore them.
