# 04: Auto-publish after a clean Auto-fill

Type: AFK
Status: done
Blocked by: None (can start immediately)
Spec: [beta spec](../spec.md)

## What to build

Department setting autoPublish; the Auto-fill action publishes when on and the period has no Hard Violations, otherwise reports why it held back.

## Acceptance criteria

- [x] With Auto-publish on, Auto-fill on a draft period publishes it and notifies staff
- [x] With Hard Violations left, the period stays draft and the scheduler is told

## Comments

- Auto-publish also holds back when Coverage Gaps remain, not only on Hard Violations: publishing an incomplete schedule automatically would surprise staff. The reason is shown in the Auto-fill message and recorded as an Audit Event.
