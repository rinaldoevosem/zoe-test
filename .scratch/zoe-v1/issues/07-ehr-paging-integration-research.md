# 07: Research: Epic / paging / clinical-comms integration paths

Type: research
Status: resolved
Blocked by: None (can start immediately)
Map: [Zoe v1 map](../map.md)

## Question

How do on-call tools feed Epic On-Call Finder and Secure Chat (interfaces, App Orchard/Showroom, HL7/FHIR, flat files)? Same for Spok, Vocera, PerfectServe, TigerConnect. Effort and certification cost for each.

## Answer

Findings: [Epic, paging and clinical-comms integrations](../../../docs/research/0004-ehr-paging-integrations.md). All claims rest on search-result summaries (open.epic.com, fhir.epic.com, vendor and hospital pages unreachable). Verify field names and fees before quoting.

- **Epic On-Call Finder is fed by a flat file, not an API.** A CSV over SFTP every 5–10 minutes, imported and mapped to Epic Team IDs by the hospital's Epic team. No certification is needed. Secure Chat reads On-Call Finder, so one feed covers both. There is no FHIR or HL7 write path for on-call.
- **Paging and comms vendors build their own connectors** against the scheduler:
  - Spok: API push every 15 minutes, or CSV over SFTP.
  - Vocera and PerfectServe: poll a REST feed for the next 48 hours.
  - TigerConnect: maps schedules to roles.
  - Voalte: mostly links out.

  Hospital IT handles SFTP, firewalls and ID mapping.
- **Cost** is hospital labour and Epic's build queue, not program fees (Epic Vendor Services is about $1.9k a year; a Showroom listing needs a live customer first).
- **Day-one need (inference):** keep the hospital's existing on-call lookup working. Minimum Zoe surface:
  - a JSON on-call feed at least 48 hours ahead, with stable external IDs and call order
  - the same as CSV pushed over SFTP every 5–15 minutes
  - a publish/change webhook
  - an ID-mapping table and token auth
  - no FHIR in v1
- **Downtime:** the scheduler and Epic back each other up. Zoe needs a static, cacheable on-call page or PDF. The 48-hour feed lets paging keep routing during a Zoe outage.
