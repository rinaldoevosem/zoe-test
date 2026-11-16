# 14: Production auth, tenancy isolation and data residency

Type: grilling
Status: open
Blocked by: 05, 06, 03
Map: [Evenly v1 map](../map.md)

## Question

Pick the auth provider and SSO/SCIM scope; confirm shared-DB + Postgres RLS (ADR-0003) or move to DB-per-tenant for enterprise buyers; region/data-residency commitments.

## Answer

Owner's answers in the stakeholder questionnaire, 2026-11-16 (https://claude.ai/artifact/1se9TniXGgXXBxQGK8yCMb):

- Sign-in: **with the hospital account** (single sign-on, second factor), phones stay signed in.
- Hosting: **a US cloud that we manage**; schedules only, never patient information.
- Still open: auth provider choice, SCIM scope, tenancy isolation detail.
