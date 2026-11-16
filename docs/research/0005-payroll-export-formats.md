# Payroll & HCM export formats: ADP, UKG, Workday, Dayforce

_Researched 2026-11-16 with the `research` skill. **Confidence caveat:** WebFetch could not resolve developers.adp.com, apps.adp.com, developer.ukg.com or www.dol.gov from this session, so every claim below comes from search-result summaries of the cited pages, not full reads. Field names are paraphrased. Treat this as **medium-to-low confidence** and re-verify against the live pages before building. The FLSA regulatory text is the exception: it matched across eCFR, Cornell LII and DOL copies, so it is higher confidence._

## Answer

- **All four vendors work the same way.** Time comes in as **hours or amounts per employee, per date, per pay code**. Each vendor validates the code against a table that the customer configures. None of them accepts Zoe's current "scheduled vs worked variance" shape as is.
- **The minimum export is a long-format CSV.** Each row carries an employee payroll ID, work date, pay code, hours *or* amount, and a source reference. Pay codes come from a per-department mapping table. A vendor preset (ADP WFN paydata column order) can come later.
- **Overtime is the hard part.** A direct-to-payroll file has to carry regular hours and overtime hours split apart: ADP's file has separate Reg Hours and O/T Hours columns. Hospitals can calculate overtime on the 40-hour week or on the 8/80 system, so Zoe should not calculate overtime in v1. It should feed a timekeeping system or a payroll clerk who does.
- **Hospitals usually route time through timekeeping.** The typical path is scheduling → timekeeping (often UKG) → payroll. UKG maps its own pay codes to payroll earning codes, and both UKG and QGenda advertise schedule-into-timekeeping interfaces. For the pilot, the realistic first target is "UKG import or a payroll clerk's spreadsheet", not a native ADP or Workday integration.
- **Physicians are paid differently.** They are FLSA-exempt with no salary test, so overtime does not apply to them. Their pay is mostly **flat amounts**: call stipends, per-shift rates and differentials. The export therefore needs an `amount` column as well as `hours`.
- **Partner programs are gated, and fees are not public.** ADP takes a revenue share and remits it 60–90 days later. Workday has Approved, Certified and Built badges. UKG and Dayforce require application. None of them is needed for a single-department CSV pilot.
- **QGenda handles pay through its own add-on.** Its Time & Attendance product applies pay rules (premium, stipend, tiered), calculates gross pay, and offers payroll exports and an API. It does not publish its export formats.

## Findings by vendor

### ADP Workforce Now / Vantage
- **API.** The Payroll Data Input API (`POST /events/payroll/v1/pay-data-input.modify`) adds a pay-data batch. Hours and earnings go in `earningInputs`. A `/meta` call returns the valid codes, and a code missing from the validation table returns a 400 error (https://marketplace-cdn.adp.com/dev-portal/pdf/protected/Payroll_Data_Input_API__Guide_for_ADP_Workforce_Now; https://marketplace-cdn.adp.com/dev-portal/pdf/protected/Payroll_Data_Input_(Payroll_Worksheet)_API_Guide_for_ADP_Workforce_Now_Next_Gen_chapter_1).
- **File.** ADP's Automated Paydata integration accepts a header-based CSV or tab-separated TXT file over SFTP (https://apps.adp.com/en-US/apps/372723/automated-paydata-integration-for-adp-workforce-now/features). Third-party guides describe the "EPI" paydata layout:
  - Co Code first, Batch ID second, File # third, followed by Reg Hours, O/T Hours and "Hours 3 Code/Amount" pairs (https://help.connecteam.com/en/articles/9296467-how-to-use-adp-workforce-now-export-template; https://help.payclock.com/Content/Integrations/Setting%20up%20to%20integrate%20and%20export%20to%20ADP%20Workforce%20Now.htm).
  - The file is named `PRcccEPI.csv`, and the user uploads it via Process → Payroll → Add Paydata Batch → Import from File (https://compt.helpscoutdocs.com/article/119-how-to-manually-upload-a-compt-payroll-report-to-adp-workforce-now).
  - These details are secondary sources (low confidence).
- **ADP's own timekeeping.** A separate Time Entries Modify (TLM) API exists for customers that use ADP's timekeeping module (https://marketplace-cdn.adp.com/dev-portal/pdf/protected/Time_Entries_Modify_TLM_API_Guide_for_ADP_Workforce_Now).
- **Vantage HCM.** Vantage has its own Payroll Data Input API. It creates a batch, runs "Import Pay Data", and the practitioner reviews the result on the Pay Data Entry page (https://marketplace-cdn.adp.com/dev-portal/pdf/protected/Payroll_Data_Input_API_Guide_for_ADP_Vantage_HCM_chapter_1).

### UKG (Pro WFM / Dimensions, Workforce Central, Pro HCM)
- **Pro WFM REST API.** `POST /v1/timekeeping/data/import` imports punches and pay-code edits in bulk (https://developer.ukg.com/wfm/reference/bulk-punches-and-paycode-edits). Rejecting duplicate punches is documented behaviour (https://sso-hlp01.gss.mykronos.com/help/en_GB/Content/ApplicationSetup/Integrations/ConfigureAPIBasedPunchesImport.htm).
- **Classic APIs.** The Classic web services have a Timesheet Edit Import whose edit types are duration, hourly, currency and numeric, plus Schedule Import and Punch Import APIs (https://developer.ukg.com/hcm/docs/workforce-management-classic-web-services; https://library.ukg.com/a/207674).
- **Pay-code mapping.** Payroll Code Mapping maps WFM pay codes to payroll earning codes, optionally by location or labor category. Pay codes that don't already exist cannot be imported (https://dcus11-hlp01.gss.mykronos.com/help/en_US/Content/ApplicationSetup/Integrations/ConfigurePayrollCodeMapping.htm; https://dcus11-hlp01.gss.mykronos.com/help/HCM/oxy_ex-2/_shared/common_topics/configure_data_hub_mappings.html).
- **Third-party schedulers already feed UKG.** UKG's own Workforce Planner integrates through API-based Schedule Import packs (https://dcus11-hlp01.gss.mykronos.com/help/HCM/administration/Application_Setup/Integrations/workforce_planner_integrations_212152.html), and Shiftboard syncs schedules with Pro WFM (https://www.shiftboard.com/wp-content/uploads/2024/04/Shiftboard-UKG-Partnership-Overview.pdf).

### Workday (HCM / Time Tracking / Payroll)
- **Time Tracking import.** The Import Reported Time Blocks web service, usually run through an EIB, references a *time entry code* by its reference ID. For hours-only blocks it uses Quantity and Date. Locked periods block edits (https://doc.workday.com/admin-guide/en-us/human-capital-management/time-tracking/entering-and-correcting-time/concepts-entering-and-correcting-time/dan1370797671748.html).
- **Payroll import.** Import Payroll Input loads *pay component* inputs (hours, rate, amount) from external sources. A blank Payroll Input ID creates duplicates if the file is re-run, and the worker must be eligible for the pay component (https://doc.workday.com/admin-guide/en-us/payroll/payroll-input/zzm1518620193483.html; https://doc.workday.com/workday-education/en-us/course-manuals/payroll-for-administrators/payroll-input.html).

### Dayforce
- **API.** The REST API has POST, PATCH and DELETE operations for Employee Punches, plus Employee Raw Punches. Raw punches are processed as if they came from a physical clock, against punch policies. Pay Adjustment Code Groups control which pay codes an employee may use (https://help.dayforce.com/r/documents/Dayforce-RESTful-Web-Services-Developer-Guide/POST-Employee-Punches; https://mi.docs.wso2.com/en/4.2.0/reference/connectors/ceridiandayforce-connector/employee-time-management/employeerawpunches/).
- **Pay codes.** A third-party guide says pay codes must be pre-created in Dayforce and mapped by XRef code (https://knowledgebase.flaik.com/flaik-knowledge-base/for-it-specialists/payroll-export-configuration/resort-specific-info/dayforce) (low confidence).

### (a) Physician pay vs hourly staff
- **Exemption.** Licensed physicians who actually practise, and residents, are exempt as learned professionals, and the salary-basis requirement does not apply to them (https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-D/section-541.304). Nurses, therapists and technologists do not get that salary exception (https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G).
- **8/80 for hourly staff.** Hospitals may use a 14-day period with overtime after 8 hours a day or 80 hours per period, but only by prior agreement, and only one system per employee (https://www.dol.gov/whd/regs/compliance/whdfs54.htm; https://www.law.cornell.edu/cfr/text/29/778.601).
- **On-call time.** It counts as hours worked if the employee must stay on or near the premises. "Leave word where you can be reached" call does not (https://www.govinfo.gov/content/pkg/CFR-2011-title29-vol3/pdf/CFR-2011-title29-vol3-sec785-17.pdf). For non-exempt staff, call stipends still go into the regular rate (https://jjkellercompliancenetwork.com/regsense/do-we-have-to-pay-an-employee-who-is-on-call) (secondary source).
- **Physician call pay.** MGMA data (2015) showed daily stipends were the most common model (~36%), followed by hourly (~27%) and per-shift (~14%) (https://www.beckersasc.com/?p=3768) (dated secondary source).
- **What this means for the export:** physician rows are *count × rate* or *flat amount*, not hours × rate, so the file needs `amount` and `units` columns.

### (b) Typical hospital flow
- UKG markets its own physician scheduler, EZCall, as "integrated with all UKG workforce platforms" so that it automates timekeeping and payroll (https://contentmain.www.ukg.com/sites/default/files/2023-04/hc0330-usv4-ezcall-physicians-ds.pdf). That positioning shows timekeeping sits between scheduling and payroll.
- QGenda's staff product pulls location, shift type and pay rate *from the schedule into clock-in* (https://platform.softwareone.com/product/qgenda-time-and-attendance-for-nurse-and-staff/PCP-9035-3950).
- UKG's pay-code-to-earning-code mapping layer (above) is where hospitals keep pay policy. Zoe should feed that layer, not replace it.

### (c) Partner programs
- **ADP Marketplace.** Partners must be accepted and must sign a sandbox agreement before they get API access. ADP bills the client and remits the partner's share net of ADP's share in 60–90 days. The percentage is not public (https://marketplace-cdn.adp.com/dev-portal/pdf/protected/ADP_Marketplace_Pricing_and_How_to_Setup_Free_Trial; https://adp.com/who-we-serve/by-partner/software-providers-development.aspx).
- **UKG Partner Network.** UKG lists more than 245 partners. Its fees are not published, and a 2022 accelerator press release waived the annual fee for its cohort, which implies a fee normally applies (https://www.businesswire.com/news/home/20221013005452/en; https://www.ukg.com/for-llms/company/partners).
- **Workday.** Badge tiers are Approved (minimum requirements), Certified (at least 90% of standard use cases) and Built (co-developed with Workday). Costs are not public (https://www.workday.com/en-us/partners-services/partners/software-partners.html).
- **Dayforce.** The Partner Network has Platform Partner and Approved Connector tiers. Dayforce Marketplace is announced for 2027 (https://www.dayforce.com/how-we-help/services-and-support/partners/technology-and-innovation-partners; https://itbrief.com.au/story/dayforce-launches-build-marketplace-for-hr-software).

### (d) QGenda
- **Product.** QGenda Time and Attendance for Providers advertises built-in pay rules for premium pay, stipends and tiered rates by seniority or partner status. It calculates gross pay and "integrates with payroll processors" (https://platform.softwareone.com/product/qgenda-time-and-attendance-for-providers/PCP-6377-0878).
- **Pay codes follow the schedule.** Its pay codes update as the schedule changes (https://platform.softwareone.com/product/qgenda-time-and-attendance/PCP-5484-2391).
- **API.** API v2 has TimeEvent endpoints (GET, POST and PUT `/v2/timeevent`, with 31–100 day windows) and Pay Code and Pay Rate APIs (https://apis.io/apis/qgenda/qgenda-time-event-api/; https://apis.io/apis/qgenda/qgenda-pay-code-api/).
- **Integration list.** Integration targets include ADP, Workday and Kronos (https://intuitionlabs.ai/software/pdfs/qgenda.pdf).
- **Gap.** I found no public export layout for QGenda, and every QGenda claim here comes from a secondary source.

## Implications for Zoe

1. **Keep calculation out of v1.** Zoe should export classified time, not gross pay. The pilot's timekeeping system or payroll clerk applies overtime (40-hour or 8/80), differentials and the regular-rate rules.
2. **Add a per-department Pay Code Map.** It maps Zoe's categories (regular worked, call stipend, call-back worked, per-shift, night/weekend/holiday differential) to the customer's code strings. All four vendors reject unknown codes.
3. **Make the export idempotent.** Use a stable `source_ref` and a batch ID, because Workday payroll input and UKG punch import both create duplicates if a file is re-run.
4. **Proposed minimum export schema.** Use long-format CSV, one row per employee × work date × pay code.

| Column | Notes | Vendor equivalent |
|---|---|---|
| `employee_payroll_id` | the customer's ID, stored on the Staff record | ADP File #, UKG person number, Workday Employee ID, Dayforce XRef |
| `company_code` | optional constant | ADP Co Code |
| `batch_id` | per export, for example YYMMDD-seq | ADP Batch ID |
| `period_start`, `period_end` | the pay period | — |
| `work_date` | the date the shift started | Workday Date |
| `pay_code` | taken from the Pay Code Map | earning code / paycode / time entry code / pay component |
| `hours` | decimal with 2 places; blank for flat pay | Reg/O/T Hours, Quantity |
| `units` | count, for example 1 call night; optional | — |
| `amount` | flat dollars for stipends and per-shift pay; optional | Hours 3 Amount, currency edit |
| `cost_center` | department or location | labor level / worktag |
| `source_ref` | the Time Entry or Shift ID | Payroll Input ID |

5. **Defer:** ADP and Workday API connectors, overtime calculation, and marketplace listings. Revisit them after the pilot shows which system it actually loads into.

## Open questions for the owner

1. What does the pilot department load time into: UKG timekeeping, ADP WFN paydata, Workday, or a clerk's spreadsheet? This decides the first preset.
2. Are the pilot's users physicians (stipend or per-shift pay), hourly staff (overtime), or both?
3. Who owns overtime and differential calculation: the hospital's timekeeping system, or Zoe in a later version?
4. Does the department pay call as a daily stipend, as hourly call-back, or both?
5. Is there budget or appetite to apply to ADP or UKG partner programs within 12 months?
6. Can someone with access to a hospital tenant confirm the exact ADP EPI headers and the UKG import schema? I could not fetch those primary pages.

## Sources

- **ADP:**
  - https://marketplace-cdn.adp.com/dev-portal/pdf/protected/Payroll_Data_Input_API__Guide_for_ADP_Workforce_Now
  - https://marketplace-cdn.adp.com/dev-portal/pdf/protected/Payroll_Data_Input_(Payroll_Worksheet)_API_Guide_for_ADP_Workforce_Now_Next_Gen_chapter_1
  - https://marketplace-cdn.adp.com/dev-portal/pdf/protected/Payroll_Data_Input_API_Guide_for_ADP_Vantage_HCM_chapter_1
  - https://marketplace-cdn.adp.com/dev-portal/pdf/protected/Time_Entries_Modify_TLM_API_Guide_for_ADP_Workforce_Now
  - https://apps.adp.com/en-US/apps/372723/automated-paydata-integration-for-adp-workforce-now/features
  - https://marketplace-cdn.adp.com/dev-portal/pdf/protected/ADP_Marketplace_Pricing_and_How_to_Setup_Free_Trial
  - https://adp.com/who-we-serve/by-partner/software-providers-development.aspx
  - Third-party: https://help.connecteam.com/en/articles/9296467-how-to-use-adp-workforce-now-export-template, https://help.payclock.com/Content/Integrations/Setting%20up%20to%20integrate%20and%20export%20to%20ADP%20Workforce%20Now.htm, https://compt.helpscoutdocs.com/article/119-how-to-manually-upload-a-compt-payroll-report-to-adp-workforce-now
- **UKG:**
  - https://developer.ukg.com/wfm/reference/bulk-punches-and-paycode-edits
  - https://developer.ukg.com/hcm/docs/workforce-management-classic-web-services
  - https://library.ukg.com/a/207674
  - https://dcus11-hlp01.gss.mykronos.com/help/en_US/Content/ApplicationSetup/Integrations/ConfigurePayrollCodeMapping.htm
  - https://dcus11-hlp01.gss.mykronos.com/help/HCM/oxy_ex-2/_shared/common_topics/configure_data_hub_mappings.html
  - https://dcus11-hlp01.gss.mykronos.com/help/HCM/administration/Application_Setup/Integrations/workforce_planner_integrations_212152.html
  - https://sso-hlp01.gss.mykronos.com/help/en_GB/Content/ApplicationSetup/Integrations/ConfigureAPIBasedPunchesImport.htm
  - https://contentmain.www.ukg.com/sites/default/files/2023-04/hc0330-usv4-ezcall-physicians-ds.pdf
  - https://www.ukg.com/for-llms/company/partners
  - https://www.businesswire.com/news/home/20221013005452/en
  - https://www.shiftboard.com/wp-content/uploads/2024/04/Shiftboard-UKG-Partnership-Overview.pdf
- **Workday:**
  - https://doc.workday.com/admin-guide/en-us/human-capital-management/time-tracking/entering-and-correcting-time/concepts-entering-and-correcting-time/dan1370797671748.html
  - https://doc.workday.com/admin-guide/en-us/payroll/payroll-input/zzm1518620193483.html
  - https://doc.workday.com/workday-education/en-us/course-manuals/payroll-for-administrators/payroll-input.html
  - https://www.workday.com/en-us/partners-services/partners/software-partners.html
- **Dayforce:**
  - https://help.dayforce.com/r/documents/Dayforce-RESTful-Web-Services-Developer-Guide/POST-Employee-Punches
  - https://www.dayforce.com/how-we-help/services-and-support/partners/technology-and-innovation-partners
  - https://itbrief.com.au/story/dayforce-launches-build-marketplace-for-hr-software
  - Third-party: https://mi.docs.wso2.com/en/4.2.0/reference/connectors/ceridiandayforce-connector/employee-time-management/employeerawpunches/, https://knowledgebase.flaik.com/flaik-knowledge-base/for-it-specialists/payroll-export-configuration/resort-specific-info/dayforce
- **FLSA:**
  - https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-D/section-541.304
  - https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G
  - https://www.dol.gov/whd/regs/compliance/whdfs54.htm
  - https://www.law.cornell.edu/cfr/text/29/778.601
  - https://www.govinfo.gov/content/pkg/CFR-2011-title29-vol3/pdf/CFR-2011-title29-vol3-sec785-17.pdf
  - https://jjkellercompliancenetwork.com/regsense/do-we-have-to-pay-an-employee-who-is-on-call
- **Physician pay:**
  - https://www.beckersasc.com/?p=3768
- **QGenda** (all secondary):
  - https://platform.softwareone.com/product/qgenda-time-and-attendance-for-providers/PCP-6377-0878
  - https://platform.softwareone.com/product/qgenda-time-and-attendance/PCP-5484-2391
  - https://platform.softwareone.com/product/qgenda-time-and-attendance-for-nurse-and-staff/PCP-9035-3950
  - https://apis.io/apis/qgenda/qgenda-time-event-api/
  - https://apis.io/apis/qgenda/qgenda-pay-code-api/
  - https://intuitionlabs.ai/software/pdfs/qgenda.pdf
