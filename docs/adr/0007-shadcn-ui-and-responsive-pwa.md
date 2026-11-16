# UI is vendored shadcn/ui on Tailwind v4, delivered as one responsive PWA

Components are copied from shadcn/ui (MIT) into `evenly/src/components/ui` and owned by us, styled with Tailwind CSS v4 tokens. Staff use the same responsive app on phones (installable PWA, long-lived sessions) instead of a separate native app. Incumbent native apps are the most-reviewed pain point (forced logouts, features missing vs. web, stale data); one codebase means feature parity by construction. Native wrappers (push notifications) can be added later around the same app.

## Considered Options

- **Component library dependency (MUI, Chakra)** — fast start, but theming fights and upgrade churn; shadcn's copy-in model gives ownership.
- **Paid kits (Tailwind Plus/Catalyst)** — not MIT; can't be published in an open repository.
