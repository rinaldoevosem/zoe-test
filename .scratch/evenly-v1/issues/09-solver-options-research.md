# 09: Research: constraint solvers for Auto-fill at scale

Type: research
Status: resolved
Blocked by: None (can start immediately)
Map: [Evenly v1 map](../map.md)

## Question

Compare greedy (today) vs CP-SAT (OR-Tools), Timefold, and MILP for departments of 20–300 staff: solution quality on fairness, run time, explainability, licensing, and how to call them from Node (WASM, sidecar service).

## Answer

Findings: [Auto-fill solver options](../../../docs/research/0006-autofill-solver-options.md). Solver facts come from each project's own GitHub sources and docs. Literature, Gurobi and MiniZinc claims rest on search summaries, marked (LC) in the note.

- **v1: keep the greedy Auto-fill.** It already meets the hard requirements: fills only gaps, respects Locked Assignments, explains every pick, deterministic. Its weakness is period-wide fairness, because it never revisits earlier picks.
- **Future solver: CP-SAT** (Google OR-Tools, Apache-2.0).
  - Models Evenly's Rules directly.
  - Fixes Locked Assignments.
  - Accepts the current schedule as hints.
  - Runs deterministically.
  - Can name the conflicting Rules for an unfillable gap.

  It has no official Node binding, so it needs a Python sidecar behind the same Auto-fill interface.
- **Rejected for now:**
  - highs-js (MIT, in-process): single-threaded; likely struggles at 300 staff × 3 months (inference, needs a benchmark).
  - Timefold Community: Java-only, and its explanation features are Enterprise-only.
  - Gurobi: commercial.
  - CBC: volunteer-maintained.
- **Keeping explanations with a solver:** show Rule slack, re-solve with "why not this person?" forced (counterfactual), and name the conflicting Rules for unfilled gaps.
- **Trigger for adding the CP-SAT adapter:** a department's Load spread per FTE exceeds an agreed threshold, or greedy leaves gaps that a feasibility check shows are fillable. Greedy stays the default and the fallback.
