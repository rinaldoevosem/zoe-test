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
- Review follow-ups: de-duplication now claims a key in `notification_keys` (primary key), so concurrent runs can't double-send. Urgent alert keys follow the Shift's current cover, so a Shift that loses cover again is alerted again. Removing someone from a published on-call Shift checks for Urgent gaps immediately. Each Department runs in isolation, and the cron secret is compared in constant time.
- Known limit: with only a daily scheduler run, gaps that appear any other way (e.g. a Staff Member's Tag removed) are alerted at the next run. An hourly schedule is recommended in production.
