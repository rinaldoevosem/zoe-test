# 07: Daily job: Certification reminders and Urgent coverage alerts

Type: AFK
Status: done
Blocked by: 03
Spec: [beta spec](../spec.md)

## What to build

A protected daily endpoint sends 30-day Certification reminders and Urgent alerts for on-call Shifts below headcount in the next 24 hours, without duplicates.

## Acceptance criteria

- [x] Running the job twice sends each reminder and alert once
- [x] Without the shared secret the endpoint refuses

## Comments

- `/api/cron/daily` refuses every call unless `CRON_SECRET` is set and sent as `Authorization: Bearer …` (Vercel Cron does this). `vercel.json` schedules it at 12:00 UTC (07:00 New York).
- Expired Certifications notify schedulers once; reminders go to the Staff Member within 30 days of expiry.
