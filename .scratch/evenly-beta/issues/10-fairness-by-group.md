# 10: Fairness compared within comparable groups

Type: AFK
Status: ready-for-agent
Blocked by: None (can start immediately)
Spec: [beta spec](../spec.md)

## What to build

The fairness summary compares every Staff Member in one pool, so nocturnists, hospitalists and APPs read as "not equitable" against each other in the hospital medicine demo. Compare Load within groups that share work (by Clinical Role, or by the set of Shift Types people are eligible for) and show one fairness line per group.

## Acceptance criteria

- [ ] The hospital medicine demo reports a separate fairness line for hospitalists, nocturnists and APPs
- [ ] Each group's spread is judged against its own average
- [ ] Existing single-pool Departments read the same as today
