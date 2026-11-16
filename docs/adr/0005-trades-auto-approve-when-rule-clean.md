# Rule-clean trades are approved automatically by default

A Swap or Giveaway that both parties accept and that produces no new Hard Violation is applied immediately and both parties are notified; schedulers see it in the Audit Event stream and can revert it. Departments can switch to "scheduler approves every trade". Users of incumbent tools report trades stuck for days awaiting an admin who re-checks by hand what software could check; ADR-0002 makes the automatic check trustworthy. Soft Violations do not block, but are shown to both parties before they accept.
