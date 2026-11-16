# 04: Auto-publish after a clean Auto-fill

Type: AFK
Status: open
Blocked by: None (can start immediately)
Spec: [beta spec](../spec.md)

## What to build

Department setting autoPublish; the Auto-fill action publishes when on and the period has no Hard Violations, otherwise reports why it held back.

## Acceptance criteria

- [ ] With Auto-publish on, Auto-fill on a draft period publishes it and notifies staff
- [ ] With Hard Violations left, the period stays draft and the scheduler is told
