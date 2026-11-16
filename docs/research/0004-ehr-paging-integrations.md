# Epic, paging and clinical-comms integration paths for on-call schedules

_Researched 2026-11-16 with the `research` skill. **Confidence caveat:** WebFetch could not resolve any primary host from this session (open.epic.com, lightning-bolt.com, knowledge.spok.com, it.houstonmethodist.org, texaschildrensnews.org all failed DNS). Every claim below rests on search-engine summaries of the cited pages, not full reads. Treat field names, fees and frequencies as lower confidence until someone reads the pages directly._

## Answer

- **Epic On-Call Finder (OCF) is fed by a flat file, not an API.** The vendor that documents it, Lightning Bolt/PerfectServe, sends a CSV to SFTP every 5–10 minutes. The hospital's Epic team imports it and maps it to Epic Team IDs. QGenda and Amion feed the same OCF at Texas Children's, Houston Methodist and Providence, with Amion syncing hourly. No HL7v2 or FHIR on-call interface turned up.
- **Epic Secure Chat reads on-call data from OCF.** Clinicians open the OCF team and tap a chat button. One vendor also writes the current on-call person into Secure Chat directly, through a service-account "background user". If Zoe feeds OCF, Secure Chat comes along.
- **Paging and comms vendors pull from the scheduler, or the scheduler pushes to them.** Spok Smart Center is called by QGenda through its XML API every 15 minutes. Spok Go takes a CSV over SFTP. Vocera Engage polls QGenda's REST API through a vendor-built adapter. PerfectServe polls every 15 minutes for the next 48 hours. TigerConnect maps on-call schedules to roles. Voalte mostly just links out to QGenda.
- **Who builds it:** the comms vendor usually builds and owns the connector, the scheduler supplies an API or file, and hospital IT handles firewalls, SFTP, ID mapping and the Epic import build. QGenda's customer-success team configures its side.
- **Program cost is small; hospital labour is the real cost.** Epic Vendor Services costs about $1,900/yr. A Showroom Connection Hub listing is reported at about $500/yr per app and requires one live customer first. No Epic certification is required for a flat-file OCF feed. Timelines run on the hospital's Epic build queue: months, and phased.
- **Day one for a single-department pilot:** don't break the hospital's existing on-call lookup. In practice that means a CSV feed to OCF (if the hospital uses it) or to the switchboard/paging system, plus a read-only web directory. Native comms-vendor adapters come later.
- **Minimum Zoe surface:** a stable on-call feed (JSON and CSV) with external person IDs, team/service IDs and call order. Add SFTP push on a schedule, a webhook on publish or change, and a static, cacheable fallback page. FHIR endpoints are not needed yet.

## Detailed findings

### Epic On-Call Finder and Secure Chat

- **Mechanism (CSV over SFTP).** In Lightning Bolt's integration, a provider scheduled on a mapped assignment is written into a CSV that goes to SFTP for import into Epic, typically every 5–10 minutes. Customer IT can automate the import (https://www.lightning-bolt.com/integrations/epic-on-call-finder; https://www.lightning-bolt.com/wp-content/uploads/2026/04/SCH_Integrations-Catalog.pdf).
  - **Mapped fields:** Epic Team ID, an optional team name, a resource type, call order, an "Import Group" facility mapping, and a unique provider ID that matches the Epic user (https://www.lightning-bolt.com/download/perfectserve-integrations-catalog/).
  - **Hosting and extras:** SFTP is ideally hosted by the hospital, but the vendor can host it. Team comments appear as a banner in OCF (https://www.lightning-bolt.com/integrations/epic-on-call-finder).
- **No HL7v2 or FHIR write path found.** Epic's HL7v2 scheduling list covers appointment interfaces only (https://open.epic.com/Scheduling/HL7v2). On fhir.epic.com, PractitionerRole and Schedule are read/search only, Slot is STU3 read, and no create for these resources was found (https://fhir.epic.com). These resources model clinic appointment slots, not call rotations.
- **QGenda (incumbent).** At Houston Methodist, QGenda holds the schedule and OCF displays it in Epic. OCF tiles carry a Secure Chat button (https://it.houstonmethodist.org/wp-content/uploads/2025/09/QGenda-FAQ-Houston-Methodist-7-15-25.pdf). Rollout went by launch groups, and some enterprise schedules such as telestroke came later (https://it.houstonmethodist.org/qgenda/).
  - Texas Children's announced in June 2026 and went live on July 13, 2026. QGenda remains the source of truth and the backup during Epic downtime. Providers are prompted to sign in at the start of a shift so Epic holds the right contact (https://texaschildrensnews.org/epic-on-call-finder-with-qgenda-integration-goes-live-july-13/; https://texaschildrensnews.org/texas-childrens-launching-epic-on-call-finder-in-june-2026/).
  - QGenda's own interface spec was not found publicly.
- **Amion.** Schedules are ingested into OCF and visible in Hyperspace, Haiku and Canto. The integration is Enterprise-only (https://support.amion.com/hc/en-us/articles/26606230093971-Amion-Epic-Integration). Providence reports an hourly sync and tells staff to confirm in Amion when OCF is unclear (https://blog.providence.org/south-puget-sound-medical-staff-updates/amion-live-in-south-puget-sound).
- **Secure Chat.** The workflow is to find the team in OCF, then open chat (https://www.wikem.org/w/images/Epic_Secure_Chat.pdf). Lightning Bolt also pushes to messaging vendors, Epic Secure Chat included, through a "background user" account that updates the on-call provider on schedule changes and emails admins when a transaction fails (https://www.lightning-bolt.com/integrations/secure-messaging/).
- **Who builds it.** The scheduler vendor generates the file; the hospital's Epic analysts build the OCF teams and the import. Hospitals hire "Epic On-Call Finder analyst" roles for this work (https://career.com/job/kforce-inc/epic-on-call-finder-analyst/j202503312210002191338).
- **Programs and cost.** open.epic is free. Vendor Services costs $1,900/yr, and Toolbox is available only in specific categories (https://open.epic.com/EpicSupport). A Connection Hub listing requires at least one live Epic connection and is reported at $500/yr per app; that figure comes from a vendor deck and is not confirmed by Epic (https://vendorservices.epic.com/Resources/OEC08; https://www.epic.com/epic/post/epic-launches-connection-hub/). No Showroom listing for QGenda was found.

### Paging and clinical-communications vendors

| Vendor | Mechanism | Builder | QGenda path |
|---|---|---|---|
| **Spok** (Smart Center / Care Connect) | QGenda calls the Spok Smart Suite XML API over HTTPS every 15 min. It is one-way: Spok edits don't flow back. Needs a firewall allow for QGenda's IPs and a valid TLS certificate on the Spok API server (https://knowledge.spok.com/Spok_Products/Smart_Suite/Configuring_Smart_Suite/Configuration_Guide_Smart_Center_with_QGenda/Configuring_Smart_Center_with_QGenda). Spok Go accepts an on-call shift CSV over SFTP through an on-prem gateway (https://knowledge.spok.com/@api/deki/files/78149/Spok_Go_File_Upload_Specs_-_On-Call_Shifts_v2.0.pdf?revision=3) | QGenda customer success configures; hospital IT opens the firewall | Push into Spok's API |
| **Vocera / Stryker** (Engage) | A Vocera-built "QGenda Adapter" reads QGenda's REST API and creates future assignments. Staff need External Call System IDs that match Vocera logins (https://pubs.vocera.com/docportal/docportal/docportal/version/topics/adapters_qgenda.html). The Amion adapter pulls 48 h ahead (https://pubs.vocera.com/rnotes/ReleaseNotes_adapter_vocera_amion_1.1.0.html) | Vocera builds a per-scheduler adapter | Vocera polls QGenda (2018 partnership: https://www.dotmed.com/news/story/45042) |
| **PerfectServe** | API pull every 15 min covering the next 48 h. Assignment and user mapping is manual at setup (https://www.perfectserve.com/integrations/scheduling-solutions/) | PerfectServe | PerfectServe pulls QGenda (https://prnewswire.com/news-releases/perfectserve-integrates-with-qgenda-to-streamline-on-call-scheduling-for-physicians-300597687.html) |
| **TigerConnect** | QGenda On-Call drives TigerConnect roles, handoffs and escalation (https://tigerconnect.com/resources/newsroom/tigerconnect-qgenda-integration/). Role-to-schedule sync is described as bidirectional (https://tigerconnect.com/products/integrations/). No public developer docs found | TigerConnect | Role mapping |
| **Voalte** (Baxter/Hillrom) | Mostly a link-out: Voalte Me/One opens QGenda, and contact workflows don't change (https://bridge.trihealth.com/our-stories/2024/november/qgenda-go-live; https://healthcareitnews.com/news/childrens-nebraska-boosts-provider-experience-workforce-management-tools). A Hillrom product reads Lightning Bolt via REST (https://fabric.dhp.hillrom.com/HelpCenterExt/External/lightning_bolt_on_call_scheduling_integration.html) | Mostly configuration | Link-out |

The pattern is consistent: the comms vendor builds the connector against a scheduler's REST API or file, polls on a 15-minute cycle with a 48-hour lookahead, and keys staff by an external ID. QGenda's REST API has `/v2/schedule`, `/v2/schedule/rotations` and `/v2/login` with bearer-token auth. This comes from a third-party mirror of QGenda's Postman collection (https://apis.io/apis/qgenda/qgenda-schedule-api/).

### Downtime expectations

- Hospitals treat the scheduler and Epic as mutual backups. QGenda is the documented fallback during Epic downtime (https://texaschildrensnews.org/epic-on-call-finder-with-qgenda-integration-goes-live-july-13/). Houston Methodist's stroke downtime process sends staff to the QGenda on-call page (https://it.houstonmethodist.org/team-activations-downtime-process/).
- During a scheduler outage, UVA routes calls through a staffed Contact Center (https://news.med.virginia.edu/?p=39747). Printing schedules before a planned downtime is standard practice (https://it.houstonmethodist.org/downtime/).
- Because Spok, Vocera and PerfectServe pull 48 hours ahead and store future assignments, they keep routing through a short scheduler outage (https://pubs.vocera.com/rnotes/ReleaseNotes_adapter_vocera_amion_1.1.0.html; https://www.perfectserve.com/integrations/scheduling-solutions/).
- Third-party monitors log QGenda incidents of roughly 40 minutes on average (https://pingoru.io/providers/qgenda/outage-history).

## Implications for Zoe

1. **Day one (inference):** a pilot department sits inside a hospital whose operators and other departments already look up on-call somewhere: OCF, Spok or a paging console, or Amion/QGenda web. Zoe must feed that place, or the pilot breaks enterprise lookup.
   - The cheapest universal door is a **scheduled CSV-over-SFTP export** of the current plus next-48h on-call. Columns: external person ID (Epic user ID / messaging ID), service/team external ID, role, call order, start and end time (UTC and local), contact note.
   - Hospital IT does the import, so Zoe needs no Epic contract.
2. **Later:** vendor-built adapters (Vocera, PerfectServe, TigerConnect) and a Spok push. These come once a comms vendor agrees to build against Zoe's API, which a single pilot won't trigger.
3. **Minimum API surface:**
   - Today's JSON on-call endpoint, extended with a date range (≥48 h ahead) and stable external IDs per person and team.
   - Token auth plus IP allow-listing.
   - A CSV variant of the same data, with SFTP push on a 5–15 minute cycle.
   - A `schedule.published` / `oncall.changed` webhook.
   - An admin-editable ID-mapping table.
   - Failure emails for mapping errors.
4. **Defer** FHIR endpoints, HL7v2 and Epic Showroom listings. Epic exposes no write path for on-call, and Connection Hub needs a live customer first.
5. **Downtime:** publish a static, cacheable on-call page and a printable PDF. Make the 48h-ahead feed the norm so downstream systems keep routing while Zoe is down. State an RTO for the directory separately from the scheduler.

## Open questions for the owner

1. Which on-call lookup does the pilot hospital use today (Epic OCF, Spok, Amion, QGenda), and who owns it?
2. Will the pilot hospital's Epic team schedule an OCF import build, and how long is their queue?
3. Which external IDs can Zoe store per person: Epic user ID, Spok messaging ID, Vocera login?
4. Is hosting SFTP (vs. pushing to hospital SFTP) acceptable to Zoe's security posture?
5. Should someone re-run this with network access to open.epic.com and knowledge.spok.com to confirm fields and fees?

## Sources

- https://www.lightning-bolt.com/integrations/epic-on-call-finder
- https://www.lightning-bolt.com/wp-content/uploads/2026/04/SCH_Integrations-Catalog.pdf
- https://www.lightning-bolt.com/download/perfectserve-integrations-catalog/
- https://www.lightning-bolt.com/integrations/secure-messaging/
- https://open.epic.com/Scheduling/HL7v2
- https://open.epic.com/EpicSupport
- https://fhir.epic.com
- https://vendorservices.epic.com/Resources/OEC08
- https://www.epic.com/epic/post/epic-launches-connection-hub/
- https://it.houstonmethodist.org/wp-content/uploads/2025/09/QGenda-FAQ-Houston-Methodist-7-15-25.pdf
- https://it.houstonmethodist.org/qgenda/
- https://it.houstonmethodist.org/team-activations-downtime-process/
- https://it.houstonmethodist.org/downtime/
- https://texaschildrensnews.org/epic-on-call-finder-with-qgenda-integration-goes-live-july-13/
- https://texaschildrensnews.org/texas-childrens-launching-epic-on-call-finder-in-june-2026/
- https://support.amion.com/hc/en-us/articles/26606230093971-Amion-Epic-Integration
- https://blog.providence.org/south-puget-sound-medical-staff-updates/amion-live-in-south-puget-sound
- https://www.wikem.org/w/images/Epic_Secure_Chat.pdf
- https://career.com/job/kforce-inc/epic-on-call-finder-analyst/j202503312210002191338
- https://knowledge.spok.com/Spok_Products/Smart_Suite/Configuring_Smart_Suite/Configuration_Guide_Smart_Center_with_QGenda/Configuring_Smart_Center_with_QGenda
- https://knowledge.spok.com/@api/deki/files/78149/Spok_Go_File_Upload_Specs_-_On-Call_Shifts_v2.0.pdf?revision=3
- https://pubs.vocera.com/docportal/docportal/docportal/version/topics/adapters_qgenda.html
- https://pubs.vocera.com/rnotes/ReleaseNotes_adapter_vocera_amion_1.1.0.html
- https://www.dotmed.com/news/story/45042
- https://www.perfectserve.com/integrations/scheduling-solutions/
- https://prnewswire.com/news-releases/perfectserve-integrates-with-qgenda-to-streamline-on-call-scheduling-for-physicians-300597687.html
- https://tigerconnect.com/resources/newsroom/tigerconnect-qgenda-integration/
- https://tigerconnect.com/products/integrations/
- https://bridge.trihealth.com/our-stories/2024/november/qgenda-go-live
- https://healthcareitnews.com/news/childrens-nebraska-boosts-provider-experience-workforce-management-tools
- https://fabric.dhp.hillrom.com/HelpCenterExt/External/lightning_bolt_on_call_scheduling_integration.html
- https://apis.io/apis/qgenda/qgenda-schedule-api/
- https://news.med.virginia.edu/?p=39747
- https://pingoru.io/providers/qgenda/outage-history
