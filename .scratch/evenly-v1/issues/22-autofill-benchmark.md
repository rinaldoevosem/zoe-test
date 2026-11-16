# 22: Task: benchmark Auto-fill fairness and gaps on a realistic department

Type: task
Status: open
Blocked by: 10
Map: [Evenly v1 map](../map.md)

## Question

Surfaced by the solver research. Run today's greedy Auto-fill on the pilot's real (anonymised) schedule and rules, or on a public benchmark of similar size if none exists. Measure:

- Load spread per FTE
- unfilled gaps that a feasibility check shows could be filled
- run time

Compare against a quick CP-SAT prototype. The numbers set the trigger threshold for adding a solver adapter and feed "Auto-fill strategy for v1".
