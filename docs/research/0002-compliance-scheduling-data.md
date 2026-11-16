# Compliance for scheduling data: HIPAA, SOC 2, BAAs, HITRUST

_Researched 2026-11-16 with the `research` skill. **Confidence note:** WebFetch could not resolve www.hhs.gov, www.ecfr.gov, www.law.cornell.edu or trust.qgenda.com from this session (DNS blocked by the session network allowlist), so every claim below rests on search-result excerpts of the cited pages, not full reads. Regulatory text was cross-checked across several excerpts; vendor claims are lower confidence. Re-verify before quoting externally or signing contracts. This is not legal advice._

## Answer

- **A staff work schedule is not PHI.** PHI excludes "employment records held by a covered entity in its role as employer" (45 CFR 160.103). Who works which shift, on-call rosters, time-off, punches and payroll exports are employment data. They become PHI only when they carry **patient** information.
- **Evenly needs a BAA only if it creates, receives, maintains or transmits patient PHI** for the hospital. A cloud host that stores PHI is a business associate even if it can't read the data, and the "conduit" exception covers transmission only. If Evenly stays patient-free, no BAA is legally required. Hospitals may still ask for one, and Evenly should be ready to sign.
- **SOC 2 and HITRUST are not legal requirements.** They are what hospital procurement asks for. SOC 2 Type II (a CPA's opinion that controls worked over a period) is the usual bar for scheduling vendors. HITRUST is typically asked of vendors that hold PHI at scale, and none of the comparable scheduling vendors publicly claims it.
- **Encryption and MFA are "addressable" under today's Security Rule.** The January 2025 proposed rule would make both mandatory and add yearly pen tests, but it was not final as of November 2026 (final action is projected for around July 2027). Hospital questionnaires already expect all of these.
- **The PHI risks in Evenly's features are free text and integrations.** Examples: notes on requests, trades or shifts, any inbound Epic, ADT or census feed, case or patient assignments on the OR or on-call board, and messaging. Employee medical reasons on time-off requests aren't PHI, but the ADA makes them confidential (EEOC).
- **For the v1 pilot, design out PHI and sign no BAA.** Ship hospital SSO, audit logs, encryption, MFA, US hosting, a third-party pen test and a security packet (a CAIQ or SIG Lite answer set). Start the SOC 2 Type II observation window now. HITRUST, TX-RAMP and any HIPAA program can wait for scale or for the first PHI-bearing feature.

## Findings

### Is a schedule PHI?

- PHI is individually identifiable health information. Its definition excludes FERPA education records and "employment records held by a covered entity in its role as employer" (https://www.govinfo.gov/content/pkg/CFR-2013-title45-vol1/pdf/CFR-2013-title45-vol1-sec160-103.pdf ; https://www.law.cornell.edu/cfr/text/45/160.103).
- HHS consumer guidance: the Privacy Rule "does not protect your employment records, even if the information in those records is health-related". Records of an employee's own treatment as a patient are still PHI (https://www.hhs.gov/ocr/privacy/hipaa/understanding/consumers/employers.html).
- Information that has been de-identified (for example, aggregate counts with no identifiers) is outside HIPAA, and a cloud provider holding only de-identified data is not a business associate (https://www.hhs.gov/hipaa/for-professionals/special-topics/cloud-computing).

### When a vendor needs a BAA

- A business associate is anyone who creates, receives, maintains or transmits PHI on behalf of a covered entity. The 2013 Omnibus Rule refused to widen the conduit exception to entities that store PHI (https://www.crowell.com/en/insights/client-alerts/conduit-exception-remains-narrow-under-new-hipaa-rule).
- The conduit exception is "limited to transmission-only services", where any access is transient (https://www.hhs.gov/hipaa/for-professionals/faq/can-a-csp-be-considered-to-be-a-conduit-like-the-postal-service-and-therefore-not-a-business-associate-that-must-comply-with-the-hipaa-rules/index.html).
- Cloud providers that store or process ePHI are business associates. "Lacking an encryption key does not exempt a CSP" from that status, and a service-level agreement (SLA) is not a BAA (https://www.hhs.gov/hipaa/for-professionals/special-topics/cloud-computing).
- What a BAA must contain is set by 45 CFR 164.504(e). The contract must require the vendor to:
  - limit its uses and disclosures of PHI;
  - apply Security Rule safeguards;
  - report breaches under 164.410 (without unreasonable delay, ≤60 days);
  - bind its subcontractors to the same terms;
  - return or destroy PHI at termination (https://www.govinfo.gov/content/pkg/CFR-2021-title45-vol2/pdf/CFR-2021-title45-vol2-sec164-504.pdf ; https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/business-associates/index.html).
- If Evenly ever takes on PHI, it must also hold BAAs with its own hosting, email and logging providers (https://www.hhs.gov/hipaa/for-professionals/special-topics/cloud-computing).

### Security Rule trajectory

- Under the current rule, encryption is "addressable" and MFA is not a named requirement. The NPRM published 2025-01-06 would mandate encryption of ePHI at rest and in transit, MFA, vulnerability scans every 6 months and penetration tests every 12 months (https://www.dwt.com/blogs/privacy--security-law-blog/2025/01/hipaa-security-rule-proposed-changes-in-2025).
- Final action has slipped from May 2026 to a projected July 2027 (https://medcurity.com/hipaa-security-rule-delayed-2027/ ; https://www.paubox.com/blog/hhs-pushes-final-hipaa-security-rule-update-to-2027). Secondary sources only; check the Unified Agenda.

### SOC 2 and HITRUST

- SOC 2 is a CPA examination of a service organization's controls against the AICPA Trust Services Criteria (TSP 100, 2017 criteria with points of focus revised in 2022) (https://linfordco.com/blog/what-is-soc-2/).
  - Security (the "common criteria") is mandatory. Availability, processing integrity, confidentiality and privacy are optional.
  - Type I tests whether controls are designed properly at a single point in time. Type II tests whether they operated effectively over a period.
  - The AICPA page itself was not retrieved; this rests on auditor summaries (https://www.a-lign.com/articles/what-is-soc-2-complete-guide-audits-and-compliance).
- HITRUST offers nested assessment levels, each including the requirements of the one before:
  - e1: roughly 44 requirements; 1-year certificate.
  - i1: roughly 182–219 requirements; 1-year certificate.
  - r2: risk-based with maturity scoring; 2-year certificate with an interim assessment.
  - Sources: https://hitrustalliance.net/advisories/haa-2021-012-i1-introduction-and-r2-enhancements ; https://www.barradvisory.com/resource/hitrust-assessments/
  - The requirement counts vary by CSF version.

### What hospital security questionnaires ask

These come from vendor-risk guides, not a primary standard, so they are lower confidence.

- **Sign-in:** SSO and MFA, with SAML or OIDC federation preferred over local accounts, and no shared credentials.
- **Audit logs:** coverage of admin actions, data exports and configuration changes, with ePHI redacted from logs and support tickets.
- **Retention:** how long each category of data is kept, including backups.
- **Evidence:** a SOC 2, ISO 27001 or HITRUST report. Without one, the vendor answers a SIG Lite or CAIQ questionnaire and attaches evidence such as pen-test results.
- **Tiering:** the depth of review scales with the vendor's risk tier.
- Sources: https://www.accountablehq.com/post/saas-vendor-risk-assessment-for-healthcare-step-by-step-guide-checklist-and-hipaa-compliance ; https://www.accountablehq.com/post/hospital-vendor-security-assessment-checklist-best-practices-to-reduce-third-party-risk
- No source covered US data residency or HECVAT. Treat both as an open item to confirm with the pilot's security team.

### Employee medical information

- The ADA requires an employer to keep employee medical information, including details volunteered with a leave request, in separate confidential files (https://www.eeoc.gov/laws/guidance/family-and-medical-leave-act-ada-and-title-vii-civil-rights-act-1964).
- A dissenting brief reads the rule more narrowly (https://www.adagreatlakes.org/Publications/Legal_Briefs/BriefNo31_Confidentiality_Requirements_Under_the_ADA_2018.pdf).
- Either way, a time-off reason such as "chemo" is not PHI, but it is sensitive. Evenly should not collect it.

### What comparable vendors claim

| Vendor | SOC 2 | HITRUST | BAA / HIPAA | Source (confidence) |
| --- | --- | --- | --- | --- |
| QGenda | SOC 2 Type 2 (Scheduling, Credentialing, ProviderCloud); also TX-RAMP; job post cites FedRAMP, SOX | None found | "HIPAA" listed for ProviderCloud; BAA not confirmed | https://trustlists.org/company/qgenda/ , https://elion.health/products/qgenda-scheduling , https://startup.jobs/compliance-analyst-qgenda-8062685 (low: third-party; trust.qgenda.com unreachable) |
| ShiftAdmin (QGenda) | Attributed to parent QGenda | None found | "HIPAA compliant" per listing | https://www.durate.com/blog/durate-vs-shiftadmin (competitor), https://www.capterra.com/p/181096/Shift-Admin/reviews/ (low) |
| PerfectServe (Lightning Bolt, Amion) | "SOC 2 compliant", aligned to SOC 2 Type II, NIST CSF, Cyber Essentials Plus | None found | "HIPAA compliant"; AES-256 at rest, TLS 1.2+, full audit trails, no locally cached PHI | https://www.perfectserve.com/trust-security/ (medium: first-party, from summary) |

PerfectServe needs SOC 2 and HIPAA because its clinical messaging carries PHI, and Lightning Bolt pushes schedules to Amion about every 10 minutes (https://www.lightning-bolt.com/integrations/secure-messaging/).

## Implications for Evenly

1. **Make "no patient data" an architectural rule (ADR).** Specifically:
   - Assign people to shift types, locations and rooms, never to patients or cases.
   - The on-call directory shows service and role only, never patient names.
   - Epic and paging integrations are outbound only (sending who is on call). Do not ingest ADT, census or case data.
   - Census or acuity, if ever needed, enters only as a manually entered aggregate number per unit.
2. **Control free text.** Replace "reason" fields on time-off requests, trades and shifts with category picklists (Vacation, CME, Sick/Personal, Other). Make any remaining note field short and private (visible only to the requester and approver), with UI copy that says "Do not include patient or medical details". Exclude notes from ICS feeds, notifications and payroll exports.
3. **Keep a BAA template ready, but don't lead with it.** The default position is "Evenly holds no PHI; BAA not required". If the pilot hospital insists, sign only after vendor BAAs are in place with the host, email and logging providers.
4. **v1 pilot minimum:**
   - SAML/OIDC SSO plus MFA for local accounts.
   - Role-based access.
   - An append-only audit log of logins, publishes, approvals, exports and configuration changes (builds on Audit Event).
   - TLS 1.2+ and encryption at rest.
   - US-region hosting, with backups and a tested restore.
   - Vulnerability scanning and dependency patching.
   - One third-party pen test, with its summary letter shared.
   - A written incident-response plan and breach-notice terms in the MSA.
   - A security packet: an architecture and data-flow diagram, a CAIQ or SIG Lite answer set, a subprocessor list and a data-retention schedule.
   - A SOC 2 Type II readiness project, with the observation window started.
5. **Can wait for scale:**
   - The SOC 2 Type II report itself (expect it in about 6–12 months), then annual renewals.
   - Adding the Availability criterion.
   - HITRUST i1 or r2, only if a PHI feature ships or large health systems demand it.
   - TX-RAMP for Texas public hospitals.
   - A full HIPAA program (risk analysis, BAAs with subprocessors), only when PHI enters scope.
   - Customer-managed keys and data-residency options.

## Open questions for the owner

- Will the pilot department's security team accept "no PHI + SOC 2 in progress + pen-test letter", or do they need a SOC 2 Type II report or BAA at signing?
- Is any PHI-adjacent feature planned within 12 months (OR case assignment, census-driven staffing, Epic inbound)? If yes, budget for a HIPAA program and possibly HITRUST.
- Which hosting provider and region will Evenly use? Does the pilot require US-only data and support access?
- Is Evenly offered as hosted SaaS, self-hosted, or both? If self-hosted (the MIT core), the hospital owns most controls, which changes the questionnaire answers.
- Should someone with network access re-verify these sources (HHS, eCFR, AICPA, trust.qgenda.com)?

## Sources

- 45 CFR 160.103 (PHI and business associate definitions): https://www.govinfo.gov/content/pkg/CFR-2013-title45-vol1/pdf/CFR-2013-title45-vol1-sec160-103.pdf ; https://www.law.cornell.edu/cfr/text/45/160.103
- 45 CFR 164.504(e) (BAA contents): https://www.govinfo.gov/content/pkg/CFR-2021-title45-vol2/pdf/CFR-2021-title45-vol2-sec164-504.pdf
- HHS, Business Associates: https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/business-associates/index.html
- HHS, Guidance on HIPAA and Cloud Computing: https://www.hhs.gov/hipaa/for-professionals/special-topics/cloud-computing
- HHS FAQ, cloud service providers and the conduit exception: https://www.hhs.gov/hipaa/for-professionals/faq/can-a-csp-be-considered-to-be-a-conduit-like-the-postal-service-and-therefore-not-a-business-associate-that-must-comply-with-the-hipaa-rules/index.html
- HHS, Employers and health information in the workplace: https://www.hhs.gov/ocr/privacy/hipaa/understanding/consumers/employers.html
- Crowell & Moring on the conduit exception: https://www.crowell.com/en/insights/client-alerts/conduit-exception-remains-narrow-under-new-hipaa-rule
- Security Rule NPRM summaries: https://www.dwt.com/blogs/privacy--security-law-blog/2025/01/hipaa-security-rule-proposed-changes-in-2025 ; https://medcurity.com/hipaa-security-rule-delayed-2027/ ; https://www.paubox.com/blog/hhs-pushes-final-hipaa-security-rule-update-to-2027
- SOC 2: https://linfordco.com/blog/what-is-soc-2/ ; https://www.a-lign.com/articles/what-is-soc-2-complete-guide-audits-and-compliance
- HITRUST: https://hitrustalliance.net/advisories/haa-2021-012-i1-introduction-and-r2-enhancements ; https://www.barradvisory.com/resource/hitrust-assessments/
- EEOC, FMLA/ADA confidentiality: https://www.eeoc.gov/laws/guidance/family-and-medical-leave-act-ada-and-title-vii-civil-rights-act-1964 ; https://www.adagreatlakes.org/Publications/Legal_Briefs/BriefNo31_Confidentiality_Requirements_Under_the_ADA_2018.pdf
- Questionnaire practice: https://www.accountablehq.com/post/saas-vendor-risk-assessment-for-healthcare-step-by-step-guide-checklist-and-hipaa-compliance ; https://www.accountablehq.com/post/hospital-vendor-security-assessment-checklist-best-practices-to-reduce-third-party-risk
- Vendors: https://www.perfectserve.com/trust-security/ ; https://www.lightning-bolt.com/integrations/secure-messaging/ ; https://trustlists.org/company/qgenda/ ; https://elion.health/products/qgenda-scheduling ; https://startup.jobs/compliance-analyst-qgenda-8062685 ; https://www.durate.com/blog/durate-vs-shiftadmin ; https://www.capterra.com/p/181096/Shift-Admin/reviews/
