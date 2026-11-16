# Map: Zoe v1 — from working prototype to a pilot-ready spec

Label: wayfinder:map
Visual: [flowchart.md](./flowchart.md) (Mermaid; also published as an Artifact)

## Destination

A **locked v1 spec** — every decision needed to take Zoe live in **one pilot clinical department** is made and written down, ready for `/to-tickets` and execution. Reaching it = ticket "Lock the v1 spec" closes.

## Notes

- Domain: clinical workforce scheduling (incumbent reference: QGenda). Vocabulary in `/GLOSSARY.md`; decisions in `/docs/adr/`.
- Every grilling ticket: call the Skill tool for `grilling` and `domain-modeling`; update `GLOSSARY.md`/ADRs inline.
- This repository was borrowed only for its instance. Its original (non-Zoe) code is irrelevant and must not be read or changed. Zoe lives in `zoe/`, `.scratch/`, `docs/`, `GLOSSARY.md`, `.claude/skills/`.
- Planning, not doing: tickets produce decisions. Building happens after the destination, from the v1 spec.
- Starting point: a working v0 prototype already exists (see `.scratch/zoe-platform/`); it is evidence for decisions, not a commitment.

## Decisions so far

- [Incumbent landscape research](../../docs/research/0001-qgenda-landscape.md): QGenda's capabilities inventoried; top user pains are mobile logouts, auto-scheduler conflict churn, slow trade approval, stale calendar sync, admin complexity, weak fairness reporting.
- [v0 prototype spec](../zoe-platform/spec.md): 40-story v0 built and tested (scheduling, Auto-fill, trades, time off, on-call, ICS, reports, audit) — proves the single-Rule-engine approach.
- [Research: compliance for scheduling data](issues/05-compliance-hosting-research.md): schedules aren't PHI; stay PHI-free by design; SOC 2 Type II is the buyer norm; v1 needs SSO+MFA, audit, encryption, US hosting, one pen test.
- [Research: payroll & HCM export formats](issues/08-payroll-export-research.md): export one row per employee × date × pay code with amount/units (physician stipends), mapped per Department; overtime stays in hospital timekeeping.
- [Research: hospital identity providers & SSO](issues/06-sso-idp-research.md): plan for Entra ID + Imprivata; SAML first; Better Auth SSO/SCIM plugins suffice for v1 (WorkOS fallback); long sliding sessions; locums via guest/federation or email-code + MFA.
- [Provisional ADRs 0001–0008](../../docs/adr/): agent-decided under delegated ownership; **re-opened** by "Confirm or overturn the provisional ADRs".

## Not yet specified

- **Clinical capacity / rooms**: whether room & space assignment belongs anywhere near v1; depends on the pilot's specialty.
- **Analytics personas**: which dashboards beyond fairness/hours a buyer needs to sign (exec, finance, CMS time allocation).
- **Compensation / productivity (wRVU)**: whether schedule data must feed compensation; unknown until the business model is set.
- **Pay-code model**: payroll research shows exports need a per-Department pay-code mapping (call stipends, per-shift rates, differentials); becomes a ticket once integration scope and the pilot's timekeeping system are known.
- **Public API & webhooks**: shape and auth, once integration scope is known.
- **Support & SLAs**: uptime targets, downtime fallback for Who's On Call (printable/offline copy).
- **Internationalisation**: languages, non-US labour rules — only if the pilot is outside the US.

## Out of scope

- Residency program management (evaluations, accreditation, GME reimbursement): a separate product category. *(Proposed — confirm in "Destination & pilot department".)*
- The repository's original, unrelated code (borrowed instance).
