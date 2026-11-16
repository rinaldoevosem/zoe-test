# One pure Rule engine judges every schedule write

Auto-fill, a scheduler's manual edit, a Swap, a Giveaway Pickup and a Time-Off approval all call the same pure function — `evaluate(schedule, rules) → Violation[]` — from `zoe/src/domain/rules`. Nothing writes an Assignment without it. This is the direct fix for the most common complaint about incumbent tools: the auto-scheduler and the manual grid disagree about what is legal, and trades are approved by hand because nobody trusts them. One evaluator makes "rule-clean" mean the same thing everywhere, so trades can be auto-approved safely and every Violation carries a human-readable reason.

Auto-fill is a deterministic greedy fill (most-constrained Shift first, lowest Load then lowest Penalty candidate) with an Explanation per pick. Deterministic output means the same inputs always produce the same schedule, which makes it testable and debuggable.

## Considered Options

- **External constraint solver (OR-Tools CP-SAT, Timefold)** — better optima on large departments, but a second runtime and opaque results. Kept as a future adapter behind the Auto-fill interface; the Rule evaluator remains the judge of its output.
