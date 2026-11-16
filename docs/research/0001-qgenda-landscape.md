# Incumbent landscape: QGenda capabilities and user-reported pain points

_Researched 2026-11-16 with the `research` skill (background agent). Network limits meant claims come from search-result summaries of the cited pages, not full page reads; quotes are paraphrased. Re-verify before quoting externally._

## What the incumbent does (capability inventory)

| Area | Capabilities users rely on | Evenly status |
| --- | --- | --- |
| Provider scheduling | Rules engine (series, targets, maximums, distribution %), auto-scheduler balancing call/weekends/holidays with history, staff & task tags, rotations, draft/published states, bulk publish | **v0**: Shift Types, Tags, Rules, deterministic explainable Auto-fill, Load fairness, draft→publish |
| Requests | Time-off and shift requests, request limits per staff/task, requests dashboard | **v0**: Time-Off Requests + daily Request Limit; per-person quotas → ticket |
| Trades | One-way giveaway/pickup, two-way swaps, owner approval, skill/FTE eligibility, swap market | **v0**: Swap, Giveaway, Pickup, rule-checked auto-approval (ADR-0005) |
| On-call | Enterprise who's-on-call directory, real-time view, credential gating, paging/Epic On-Call Finder feeds | **v0**: Who's On Call directory + JSON endpoint; Epic/paging adapters → tickets |
| Nurse & staff | Patterns, self-scheduling windows, HOT open shifts, float pool, census/acuity | Open shifts via Coverage Gap Pickup in v0; self-scheduling windows, float pool → tickets |
| Time & attendance | Geo-verified mobile clock-in, schedule-aware punches, pay rules, 20+ payroll exports | **v0**: Time Entries + payroll CSV export; geo & pay rules → tickets |
| Credentialing | Provider record, privileging, schedule gating | Tags with expiry gate eligibility (v0 via Tags); full credentialing → ticket |
| Capacity | Room assignment tied to schedules, auto-release on PTO | → ticket |
| Analytics | Persona dashboards, scheduled reports, CMS allocation | **v0**: Fairness/Load report, hours report, CSV export |
| Mobile | iOS/Android viewer, requests, swaps, push | **v0**: responsive PWA, full parity (ADR-0007) |
| Integrations | Epic, Workday/ADP/UKG, SAML SSO, REST API v2, one-way ICS | **v0**: ICS rendered on request (ADR-0006), JSON on-call API; SSO seam (ADR-0008) |

## Pain points and how Evenly answers each

| # | Theme (frequency) | Representative reports (paraphrased) | Evenly answer |
| --- | --- | --- | --- |
| 1 | Mobile logouts / re-auth on every app switch (very frequent) | "Logged out whenever I switch apps or get a text" | PWA with long-lived sliding session; no content-hiding on background (ADR-0007/0008) |
| 2 | Mobile crashes, months fail to load, truncated month view (frequent) | "Freezes going 2+ months ahead"; "entries overlap in month view" | Server-rendered agenda + month views, jump-to-month picker, no client cache to go stale |
| 3 | App is a viewer; features missing vs web (moderate) | "Pending requests don't show on calendar" | One codebase = parity; pending requests and trades shown inline on My Schedule |
| 4 | Notification noise / gaps (moderate) | duplicates; can't separate urgent from routine | In-app Notification centre with categories; urgent (Coverage Gap on call) vs routine |
| 5 | Calendar sync hours late (by design) | vendor guide: changes take several hours | Feed rendered at request time; revocable token (ADR-0006) |
| 6 | Admin learning curve, setup needs vendor (frequent) | "Admin not intuitive"; "setup took custom dev" | Plain-language Rules with defaults; every Violation explains itself; seeded demo department |
| 7 | Auto-scheduler: fixing one conflict creates another (moderate) | "gave up on auto-scheduling" | Deterministic Auto-fill respects Locked Assignments, fills only gaps, explains every pick (ADR-0002) |
| 8 | Cluttered, click-heavy UI (moderate) | "Many tabs, lots of clicking" | One schedule grid: click a cell → assign with eligible-candidate list ranked by Load |
| 9 | Weak reporting / export (moderate) | "Reports limited; needed vendor help" | Fairness and hours reports built in, CSV everywhere |
| 10 | Support degraded (moderate) | slower resolution since generic support pool | Out of product scope; open source + Audit Event trail reduces support need |
| 11 | Price opaque / high (moderate) | "expensive for small groups" | MIT-licensed core, self-hostable |
| 12 | Short outages (low) | 39–63 min incidents 2026 | Stateless app + Postgres; health endpoint; Who's On Call JSON for downtime caching |

## Sources

- Product: qgenda.com/advanced-scheduling-for-providers-with-qgenda/, /physician-scheduling-software/, /product-datasheet/qgenda-on-call-datasheet/, /time-and-attendance-providers/, /clinic-exam-room-capacity/, /insights-analytics/clinical-workforce-analytics-qgenda-insights/, /blog/self-scheduling-online-requesting/
- Customer guides: physicianforum.nm.org/qgenda-resources.html; sites.duke.edu/nephfellow/files/2021/06/QGenda-User-Sync-Manual-1.pdf; rimirad.com RIMIRAD_Cal_Sync.pdf; kansashealthsystem.com QGenda-mobile-app-guide.pdf
- API: apis.io/providers/qgenda/; github.com/jjorissen52/python-qgenda
- Reviews: capterra.com/p/90628/QGenda/reviews/; g2.com/products/qgenda-advanced-scheduling/reviews; softwareadvice.com/project-management/qgenda-profile/reviews/; getapp.ca/reviews/122503/qgenda; selecthub.com; themedicalpractice.com/tools/qgenda-review/
- KLAS: klasresearch.com/report/physician-scheduling-2023-…/2937; klasresearch.com/vendor-ratings/qgenda/65207
- App stores: apps.apple.com/us/app/qgenda/id657634288; play.google.com/store/apps/details?id=com.qgenda.mobile; justuseapp.com/en/app/657634288/qgenda/reviews
- Outages: isdown.app/status/qgenda; pingoru.io/providers/qgenda/outage-history
- Corporate: businesswire.com (Shift Admin 2021, New Innovations 2025, Workday 2026)
