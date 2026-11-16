# 05: Research: compliance for scheduling data (HIPAA, SOC 2, BAAs)

Type: research
Status: resolved
Blocked by: None (can start immediately)
Map: [Zoe v1 map](../map.md)

## Question

Is a clinical work schedule PHI? When does a scheduling vendor need a BAA, SOC 2 Type II, HITRUST? What do hospital security questionnaires require (SSO, audit logs, data residency, encryption, pen tests)? Cite primary sources (HHS, AICPA, vendor trust pages).

## Answer

Findings: [Compliance for scheduling data](../../../docs/research/0002-compliance-scheduling-data.md). All claims rest on search-result excerpts (primary sites unreachable from the session); re-verify before quoting externally.

- A staff work schedule is **not PHI**: HIPAA excludes employment records held by a covered entity as employer (45 CFR 160.103). Shifts, rosters, time off, punches and payroll stay out of scope unless they carry patient data.
- A **BAA is needed only if Zoe touches patient PHI**. Hospitals may ask for one anyway; keep a template.
- **SOC 2 Type II** is the procurement norm for scheduling vendors; HITRUST is not expected at this size (incumbents claim SOC 2, not HITRUST).
- The proposed 2025 Security Rule update (mandatory encryption, MFA, annual pen tests) is not final, with final action projected around July 2027. Build to it anyway.
- **Design rule:** keep Zoe PHI-free. Assign people to Shift Types, locations and rooms, never patients. Epic and paging integrations are outbound-only. Use picklists instead of free-text reasons.
- **v1 pilot checklist:**
  - SSO + MFA
  - audit log (exists)
  - encryption in transit and at rest
  - US hosting
  - one pen test
  - security packet
  - start the SOC 2 Type II observation window

Later: HITRUST, TX-RAMP, a full HIPAA program.
