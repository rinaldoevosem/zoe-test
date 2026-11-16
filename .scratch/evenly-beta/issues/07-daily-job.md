# 07: Daily job: Certification reminders and Urgent coverage alerts

Type: AFK
Status: open
Blocked by: 03
Spec: [beta spec](../spec.md)

## What to build

A protected daily endpoint sends 30-day Certification reminders and Urgent alerts for on-call Shifts below headcount in the next 24 hours, without duplicates.

## Acceptance criteria

- [ ] Running the job twice sends each reminder and alert once
- [ ] Without the shared secret the endpoint refuses
