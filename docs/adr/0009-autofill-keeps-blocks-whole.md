# Auto-fill keeps Blocks whole when Continuity is on

Hospital medicine, the pilot specialty, works in Blocks: one hospitalist stays on the same Day Team for about 7 days, then has about 7 days off. ADR-0002's Auto-fill picks the lowest-Load candidate for every Shift, which rotates people daily and breaks continuity of patient care. So a Department can switch on **Continuity**: among candidates with no Hard Violations, someone who holds the same Shift Type on the day before or after ranks first, then Load, Penalty and "want" as before. Blocks end through Rules, not special cases: Max consecutive days stops a Block and **Rest after Block** keeps the person off for the required days, so the lowest-Load colleague starts the next Block. With Continuity on, Coverage Gaps of the same scarcity are filled in date order rather than weekends first, so a Block grows forwards (the scarcest Shift Types, e.g. those needing a rare Certification, are still filled first). Continuing a Block never outranks the Block's own limits: a pick that would break Max consecutive days or Rest after Block, even as Soft Rules, does not count as continuing.

## Considered Options

- **Fixed rotation templates (7-on/7-off patterns stamped onto the calendar)**: predictable, but brittle around time off and uneven FTE; still useful later as a scheduler tool ("Assign a Block").
- **A solver objective for continuity**: the right long-term answer (ticket "Auto-fill strategy"), but v1 keeps the greedy fill.

## Consequences

Load is still equalised across a period, but day-to-day picks favour continuity, so Load can drift within a Block. The fairness report shows the result.
