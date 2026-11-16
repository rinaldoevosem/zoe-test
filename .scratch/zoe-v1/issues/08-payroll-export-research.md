# 08: Research: payroll & HCM export formats

Type: research
Status: resolved
Blocked by: None (can start immediately)
Map: [Zoe v1 map](../map.md)

## Question

File/API formats and pay-code models for ADP, UKG/Kronos, Workday, Dayforce. What minimum export would let a pilot run payroll from Zoe Time Entries?

## Answer

Findings: [Payroll & HCM export formats](../../../docs/research/0005-payroll-export-formats.md). Vendor-portal claims rest on search summaries (portals unreachable); FLSA citations corroborated across eCFR, Cornell and DOL.

- ADP Workforce Now and Vantage, UKG, Workday and Dayforce all import time as **hours or amounts per employee, per date, per pay code**, validated against a pay-code table the customer configures. Zoe's current scheduled/worked/variance CSV cannot be loaded as-is.
- **Minimum v1 export:** a long-format CSV with one row per employee, work date and pay code, driven by a per-Department pay-code mapping. Columns: `employee_payroll_id, company_code, batch_id, period_start, period_end, work_date, pay_code, hours, units, amount, cost_center, source_ref`.
- Hospitals usually route **schedule → timekeeping (often UKG) → payroll**, and timekeeping calculates overtime (40-hour week or the 8/80 rule). Zoe exports classified time and leaves overtime to the hospital.
- **Physicians** are FLSA-exempt (29 CFR 541.304) and are paid flat amounts: call stipends, per-shift rates, differentials. So `amount` and `units` columns are required, not just hours.
- Marketplace or partner certification is not needed for a CSV pilot; fees are unpublished.
