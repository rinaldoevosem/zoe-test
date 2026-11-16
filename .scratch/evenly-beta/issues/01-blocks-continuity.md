# 01: Blocks: Rest after Block and Continuity in Auto-fill

Type: AFK
Status: done
Blocked by: None (can start immediately)
Spec: [beta spec](../spec.md)

## What to build

Add Rest after Block and Continuity to the Rule configuration with off-by-default values, judge Rest after Block in the Rule engine, rank Continuity first in Auto-fill (ADR-0009), fill in date order when it is on, explain continued Blocks, and expose both in the Department Rules form.

## Acceptance criteria

- [x] A 7-day run followed by a Shift 3 days later violates Rest after Block (7 days, 5 off); Hard or Soft per setting
- [x] With Continuity on, Auto-fill over a fortnight gives each Day Team seat whole Blocks bounded by max consecutive days
- [x] Old Departments without the new fields behave exactly as before (existing tests unchanged)
- [x] Rules form saves both settings and re-judges published Shifts
